#include "http_server.h"

#include "httplib.h"
#include "api/api.h"

#include <nlohmann/json.hpp>

namespace eeg {

using json = nlohmann::json;

HttpServer::HttpServer(AppContext& ctx) : ctx_(ctx) {}

int HttpServer::run() {
  httplib::Server svr;

  svr.set_exception_handler([](const auto&, auto& res, std::exception_ptr ep) {
    try {
      if (ep) std::rethrow_exception(ep);
    } catch (const std::exception& e) {
      api::set_cors(res);
      res.status = 500;
      res.set_content(json({{"error", e.what()}}).dump(2), "application/json");
    }
  });

  svr.Options(R"(/api/.*)", [](const httplib::Request&, httplib::Response& res) {
    api::set_cors(res);
    res.status = 204;
  });

  api::register_all(svr, ctx_);

  return svr.listen(ctx_.cfg.host, ctx_.cfg.port) ? 0 : 1;
}

}
