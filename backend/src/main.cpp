#include "config.h"
#include "app_context.h"
#include "http_server.h"

#include <iostream>

int main() {
  try {
    auto cfg = eeg::load_config_from_env();
    eeg::AppContext ctx(std::move(cfg));
    ctx.index.scan();

    eeg::HttpServer server(ctx);
    return server.run();
  } catch (const std::exception& e) {
    std::cerr << "fatal: " << e.what() << "\n";
    return 1;
  }
}
