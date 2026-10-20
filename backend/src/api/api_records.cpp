#include "api/api.h"
#include "api/json.h"

#include <nlohmann/json.hpp>

#include <algorithm>
#include <filesystem>
#include <sstream>

namespace eeg::api {
using json = nlohmann::json;

static std::filesystem::path resolve_or_404(const httplib::Request& req, httplib::Response& res, AppContext& ctx) {
  auto path = ctx.index.resolve_path(req.matches[1].str());
  if (path.empty() || !std::filesystem::exists(path)) {
    json_error(res, 404, "record not found");
    return {};
  }
  return path;
}

static json ref_json(const eeg::RecordRef& r) {
  return json{{"id", r.id}, {"path", r.path}};
}

static std::vector<std::string> split_csv(const std::string& s) {
  std::vector<std::string> out;
  std::istringstream ss(s);
  for (std::string tok; std::getline(ss, tok, ',');) {
    if (!tok.empty()) out.push_back(tok);
  }
  return out;
}

void register_records(httplib::Server& svr, AppContext& ctx) {

  svr.Get("/api/subjects", [&ctx](const httplib::Request&, httplib::Response& res) {
    json_ok(res, json{{"subjects", ctx.index.list_subjects()}});
  });

  svr.Get(R"(/api/subjects/(S\d{3})/records)", [&ctx](const httplib::Request& req, httplib::Response& res) {
    auto sid = req.matches[1].str();
    auto recs = ctx.index.list_records_for_subject(sid);
    json arr = json::array();
    for (const auto& r : recs) arr.push_back(ref_json(r));
    json_ok(res, json{{"subject", sid}, {"records", arr}});
  });

  svr.Get("/api/records", [&ctx](const httplib::Request&, httplib::Response& res) {
    auto recs = ctx.index.list_records();
    json arr = json::array();
    for (const auto& r : recs) arr.push_back(ref_json(r));
    json_ok(res, json{{"records", arr}});
  });

  svr.Get(R"(/api/records/(.+)/metadata)", [&ctx](const httplib::Request& req, httplib::Response& res) {
    auto id = req.matches[1].str();
    auto path = resolve_or_404(req, res, ctx);
    if (path.empty()) return;

    auto m = ctx.reader.read_metadata(path, id);

    json chans = json::array();
    for (const auto& c : m.channels)
      chans.push_back(json{{"index", c.index}, {"label", c.label}, {"unit", c.unit}, {"sampleRateHz", c.sample_rate_hz}});

    json_ok(res, json{
      {"id", m.record_id},
      {"durationSec", m.duration_sec},
      {"signalsInFile", m.signals_in_file},
      {"hasAnnotations", m.has_annotations},
      {"channels", chans},
    });
  });

  svr.Get(R"(/api/records/(.+)/window)", [&ctx](const httplib::Request& req, httplib::Response& res) {
    auto id = req.matches[1].str();
    auto path = resolve_or_404(req, res, ctx);
    if (path.empty()) return;

    auto channel = req.get_param_value("channel");
    double t0 = std::stod(req.get_param_value("t0"));
    double t1 = std::stod(req.get_param_value("t1"));
    int dec = req.has_param("decimate") ? std::max(1, std::stoi(req.get_param_value("decimate"))) : 1;

    auto w = ctx.reader.read_window(path, channel, t0, t1, dec);
    json_ok(res, json{
      {"id", id}, {"channel", w.channel_label}, {"t0", w.t0},
      {"sampleRateHz", w.sample_rate_hz}, {"decimate", w.decimate}, {"samples", w.samples},
    });
  });

  svr.Get(R"(/api/records/(.+)/windows)", [&ctx](const httplib::Request& req, httplib::Response& res) {
    auto id = req.matches[1].str();
    auto path = resolve_or_404(req, res, ctx);
    if (path.empty()) return;
    if (!req.has_param("channels")) { json_error(res, 400, "missing 'channels'"); return; }

    auto channels = split_csv(req.get_param_value("channels"));
    double t0 = std::stod(req.get_param_value("t0"));
    double t1 = std::stod(req.get_param_value("t1"));
    int dec = req.has_param("decimate") ? std::max(1, std::stoi(req.get_param_value("decimate"))) : 1;

    json wins = json::array();
    for (const auto& ch : channels) {
      auto w = ctx.reader.read_window(path, ch, t0, t1, dec);
      wins.push_back(json{{"channel", w.channel_label}, {"sampleRateHz", w.sample_rate_hz}, {"samples", w.samples}});
    }

    json_ok(res, json{{"id", id}, {"t0", t0}, {"t1", t1}, {"decimate", dec}, {"windows", wins}});
  });

  svr.Get(R"(/api/records/(.+)/events)", [&ctx](const httplib::Request& req, httplib::Response& res) {
    auto id = req.matches[1].str();
    auto path = resolve_or_404(req, res, ctx);
    if (path.empty()) return;

    auto evs = ctx.reader.read_events(path);
    json arr = json::array();
    for (const auto& e : evs)
      arr.push_back(json{{"onsetSec", e.onset_sec}, {"durationSec", e.duration_sec}, {"description", e.description}});

    json_ok(res, json{{"id", id}, {"events", arr}});
  });
}

}
