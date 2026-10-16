#pragma once

#include "app_context.h"

#include "httplib.h"

namespace eeg::api {

void set_cors(httplib::Response& res);

void register_all(httplib::Server& svr, AppContext& ctx);

}
