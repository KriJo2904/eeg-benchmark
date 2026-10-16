#pragma once

#include "config.h"
#include "dataset_index.h"
#include "edf_reader.h"

namespace eeg {

struct AppContext {
  Config cfg;
  DatasetIndex index;
  EdfReader reader;

  explicit AppContext(Config c) : cfg(std::move(c)), index(cfg.dataset_root) {}
};

}
