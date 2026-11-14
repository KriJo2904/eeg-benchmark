#pragma once

#include <string>

namespace eeg {

struct Config {
  std::string host = "127.0.0.1";
  int port = 8080;

  std::string data_dir;

  std::string projects_api_url = "http://127.0.0.1:3000";
};

Config load_config_from_env();

}
