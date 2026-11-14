#include "api/api.h"
#include "api/json.h"
#include "pipeline/parallel_for.h"

#include <nlohmann/json.hpp>
#include <unistd.h>

#include <chrono>

namespace eeg::api {
using json = nlohmann::json;

void set_cors(httplib::Response& res) {
  res.set_header("Access-Control-Allow-Origin", "*");
  res.set_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.set_header("Access-Control-Allow-Headers", "Content-Type");
}

void register_records(httplib::Server& svr, eeg::AppContext& ctx);
void register_pipeline(httplib::Server& svr, eeg::AppContext& ctx);
void register_files(httplib::Server& svr, eeg::AppContext& ctx);

static std::string host_name() {
  char buf[256] = {};
  if (gethostname(buf, sizeof(buf) - 1) != 0) return "";
  return buf;
}

static json check_projects_api(const std::string& url) {
  const auto start = std::chrono::steady_clock::now();
  httplib::Client cli(url);
  cli.set_connection_timeout(1, 0);
  cli.set_read_timeout(2, 0);
  auto res = cli.Get("/health");
  const auto ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count();

  json out{{"url", url}, {"ms", ms}};
  if (!res) {
    out["ok"] = false;
    out["error"] = "brak odpowiedzi (" + httplib::to_string(res.error()) + ")";
  } else if (res->status != 200) {
    out["ok"] = false;
    out["error"] = "HTTP " + std::to_string(res->status);
  } else {
    out["ok"] = true;
  }
  return out;
}

void register_all(httplib::Server& svr, eeg::AppContext& ctx) {
  svr.Get("/api/ping", [](const httplib::Request&, httplib::Response& res) {
    json_ok(res, json{{"ok", true}});
  });

  svr.Get("/api/status", [&ctx](const httplib::Request&, httplib::Response& res) {
    json_ok(res, json{{"ok", true},
                      {"version", "0.1.0"},
                      {"host", host_name()},
                      {"threads", eeg::pipeline::default_threads()},
                      {"dataDir", ctx.data.root().string()},
                      {"projectsApi", check_projects_api(ctx.cfg.projects_api_url)}});
  });

  register_records(svr, ctx);
  register_pipeline(svr, ctx);
  register_files(svr, ctx);
}

}
