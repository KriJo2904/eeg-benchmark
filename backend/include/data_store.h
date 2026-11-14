#pragma once

#include "dataset_index.h"

#include <filesystem>
#include <map>
#include <memory>
#include <mutex>
#include <string>

namespace eeg {

bool valid_name(const std::string& name);

class DataStore {
 public:
  explicit DataStore(std::filesystem::path root);

  const std::filesystem::path& root() const { return root_; }

  std::filesystem::path resolve(const std::string& rel) const;

  std::shared_ptr<const DatasetIndex> dataset(const std::string& rel);

  void clear();

 private:
  std::filesystem::path root_;
  std::mutex mutex_;
  std::map<std::string, std::shared_ptr<const DatasetIndex>> cache_;
};

}
