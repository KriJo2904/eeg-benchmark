#include "config.h"

#include <cstdlib>
#include <filesystem>

namespace eeg {

static std::string getenv_str(const char* key) {
  const char* v = std::getenv(key);
  return v ? std::string(v) : std::string{};
}

Config load_config_from_env() {
  Config cfg;
  cfg.dataset_root = getenv_str("EEG_DATASET_ROOT");

  if (cfg.dataset_root.empty()) {
    cfg.dataset_root = (std::filesystem::current_path() / "data" / "eegmmidb").string();
  }

  if (auto port_s = getenv_str("PORT"); !port_s.empty()) {
    try {
      cfg.port = std::stoi(port_s);
    } catch (...) {
    }
  }
  if (auto host_s = getenv_str("HOST"); !host_s.empty()) {
    cfg.host = host_s;
  }
  if (auto api = getenv_str("PROJECTS_API_URL"); !api.empty()) {
    cfg.projects_api_url = api;
  }

  return cfg;
}

}
