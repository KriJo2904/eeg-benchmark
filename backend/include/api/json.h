#pragma once

#include <nlohmann/json.hpp>
#include "httplib.h"
#include "api/api.h"

#include <string>

namespace eeg::api {

inline void json_ok(httplib::Response& res, const nlohmann::json& payload, int status = 200) {
  set_cors(res);
  res.status = status;
  res.set_content(payload.dump(), "application/json");
}

inline void json_error(httplib::Response& res, int status, const std::string& message) {
  set_cors(res);
  res.status = status;
  res.set_content(nlohmann::json({{"error", message}}).dump(2), "application/json");
}

}
