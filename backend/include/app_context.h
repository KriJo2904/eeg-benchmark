#pragma once

#include "config.h"
#include "data_store.h"
#include "downloads.h"
#include "edf_reader.h"

namespace eeg {

struct AppContext {
  Config cfg;
  DataStore data;
  Downloads downloads;
  EdfReader reader;

  explicit AppContext(Config c) : cfg(std::move(c)), data(cfg.data_dir), downloads(data) {}
};

}
