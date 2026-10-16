#pragma once

#include "app_context.h"

namespace eeg {

class HttpServer {
 public:
  explicit HttpServer(AppContext& ctx);
  int run();

 private:
  AppContext& ctx_;
};

}
