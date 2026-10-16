#include "api/api.h"
#include "api/json.h"

#include <nlohmann/json.hpp>

namespace eeg::api {
using json = nlohmann::json;

void set_cors(httplib::Response& res) {
  res.set_header("Access-Control-Allow-Origin", "*");
  res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set_header("Access-Control-Allow-Headers", "Content-Type");
}

void register_records(httplib::Server& svr, eeg::AppContext& ctx);
void register_pipeline(httplib::Server& svr, eeg::AppContext& ctx);

void register_all(httplib::Server& svr, eeg::AppContext& ctx) {
  svr.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
    json_ok(res, json{{"ok", true}, {"name", "eeg_server"}, {"version", "0.1.0"}});
  });

  register_records(svr, ctx);
  register_pipeline(svr, ctx);
}

}
