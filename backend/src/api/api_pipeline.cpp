#include "api/api.h"
#include "api/json.h"

#include "analysis/analysis.h"
#include "analysis/benchmark.h"
#include "analysis/selection.h"
#include "pipeline/parallel_for.h"
#include "pipeline/pipeline.h"
#include "pipeline/project_store.h"

#include <nlohmann/json.hpp>

#include <atomic>
#include <exception>
#include <mutex>
#include <string>

namespace eeg::api {
using json = nlohmann::json;

namespace {

std::string sse(const std::string& event, const json& data) {
  return "event: " + event + "\ndata: " + data.dump() + "\n\n";
}

std::mutex g_run_mutex;

struct PreparedAnalysis {
  eeg::pipeline::PipelineGraph graph;
  eeg::analysis::AnalysisSettings settings;
  eeg::analysis::Selection selection;
  std::vector<eeg::analysis::RecordJob> jobs;
};

PreparedAnalysis prepare(eeg::AppContext& ctx, const std::string& project_id,
                         std::size_t max_subjects = 0) {
  eeg::pipeline::ProjectStore store(ctx.cfg.projects_api_url);
  const auto data = store.fetch_project_data(project_id);

  PreparedAnalysis p;
  p.graph = eeg::pipeline::parse_pipeline(data.pipeline);
  p.settings = eeg::analysis::parse_settings(data.pipeline);
  p.selection = eeg::analysis::parse_selection(data.data_selection);
  p.jobs = eeg::analysis::resolve_records(p.selection, ctx.index, max_subjects);
  return p;
}

void stream_analysis(eeg::AppContext& ctx, const std::string& project_id, httplib::DataSink& sink) {
  std::atomic<bool> cancel{false};

  auto send = [&](const std::string& event, const json& data) {
    if (cancel) return;
    const auto frame = sse(event, data);
    if (!sink.write(frame.data(), frame.size())) cancel = true;
  };

  try {
    auto prepared = prepare(ctx, project_id);
    send("start", {{"records", prepared.jobs.size()}});

    std::lock_guard<std::mutex> run_lock(g_run_mutex);
    eeg::analysis::AnalysisOptions opt;
    opt.cancel = &cancel;
    opt.on_progress = [&](std::size_t done, std::size_t total) {
      send("progress", {{"done", done}, {"total", total}});
    };
    const auto result = eeg::analysis::run_analysis(prepared.graph, prepared.settings, prepared.jobs,
                                                    prepared.selection.channels, ctx.reader, opt);

    send("saving", json::object());
    eeg::pipeline::ProjectStore store(ctx.cfg.projects_api_url);
    store.save_analysis(project_id, eeg::analysis::to_documents(result, prepared.selection));

    send("done", {{"totalMs", result.total_ms},
                  {"epochs", result.epochs},
                  {"recordsUsed", result.records_used}});
  } catch (const std::exception& e) {
    send("analysis-error", {{"message", e.what()}});
  }
}

json benchmark_json(eeg::AppContext& ctx, const std::string& project_id, std::size_t max_subjects,
                    const std::vector<eeg::analysis::BenchVariant>& variants) {
  const auto prepared = prepare(ctx, project_id, max_subjects);

  std::lock_guard<std::mutex> lock(g_run_mutex);
  const auto bench = eeg::analysis::run_benchmark(prepared.graph, prepared.settings, prepared.jobs,
                                                  prepared.selection.channels, ctx.reader,
                                                  variants);

  json runs = json::array();
  for (const auto& r : bench.runs) {
    runs.push_back({{"threads", r.threads}, {"repeats", r.repeats}, {"ms", r.ms}});
  }

  return {{"hardwareConcurrency", bench.hardware_concurrency},
          {"subjects", bench.subjects},
          {"records", bench.records_used},
          {"epochs", bench.epochs},
          {"channels", prepared.selection.channels.size()},
          {"runs", runs}};
}

}

void register_pipeline(httplib::Server& svr, eeg::AppContext& ctx) {
  svr.Get("/api/bench/info", [](const httplib::Request&, httplib::Response& res) {
    json_ok(res, json{{"hardwareConcurrency", eeg::pipeline::default_threads()}});
  });

  svr.Get("/api/tasks", [](const httplib::Request&, httplib::Response& res) {
    json arr = json::array();
    for (const auto& t : eeg::analysis::task_types()) {
      arr.push_back({{"id", t.id}, {"name", t.name}, {"runs", t.runs}});
    }
    json_ok(res, json{{"tasks", arr}});
  });

  svr.Get(R"(/api/projects/([^/]+)/analysis/stream)",
          [&ctx](const httplib::Request& req, httplib::Response& res) {
            const std::string project_id = req.matches[1].str();
            set_cors(res);
            res.set_header("Cache-Control", "no-cache");
            res.set_chunked_content_provider(
                "text/event-stream", [project_id, &ctx](size_t, httplib::DataSink& sink) {
                  stream_analysis(ctx, project_id, sink);
                  sink.done();
                  return true;
                });
          });

  svr.Post(R"(/api/projects/([^/]+)/bench)",
           [&ctx](const httplib::Request& req, httplib::Response& res) {
             try {
               const std::size_t max_subjects =
                   req.has_param("maxSubjects") ? std::stoul(req.get_param_value("maxSubjects")) : 0;
               const auto variants =
                   req.has_param("runs")
                       ? eeg::analysis::parse_bench_variants(req.get_param_value("runs"), 3)
                       : eeg::analysis::default_bench_variants(3);
               json_ok(res, benchmark_json(ctx, req.matches[1].str(), max_subjects, variants));
             } catch (const std::exception& e) {
               json_error(res, 400, e.what());
             }
           });
}

}
