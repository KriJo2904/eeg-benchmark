#include "data_store.h"

#include <stdexcept>

namespace eeg {

namespace fs = std::filesystem;

bool valid_name(const std::string& name) {
  if (name.empty() || name.size() > 100 || name.front() == '.') return false;
  for (char c : name) {
    if (c == '/' || c == '\\' || static_cast<unsigned char>(c) < 32) return false;
  }
  return true;
}

DataStore::DataStore(fs::path root) : root_(fs::absolute(std::move(root)).lexically_normal()) {
  if (root_.filename().empty()) root_ = root_.parent_path();
  fs::create_directories(root_);
}

fs::path DataStore::resolve(const std::string& rel) const {
  std::string clean = rel;
  while (!clean.empty() && clean.front() == '/') clean.erase(0, 1);
  fs::path full = (root_ / clean).lexically_normal();
  if (full.filename().empty()) full = full.parent_path();
  const fs::path inside = full.lexically_relative(root_);
  if (inside.empty() || *inside.begin() == "..") {
    throw std::invalid_argument("Ścieżka poza katalogiem danych: " + rel);
  }
  return full;
}

std::shared_ptr<const DatasetIndex> DataStore::dataset(const std::string& rel) {
  const fs::path path = resolve(rel);
  if (path == root_ || !fs::is_directory(path)) {
    throw std::invalid_argument("Nie ma takiego zbioru danych: " + rel);
  }
  const std::string key = path.string();

  std::lock_guard<std::mutex> lock(mutex_);
  auto it = cache_.find(key);
  if (it != cache_.end()) return it->second;

  auto index = std::make_shared<DatasetIndex>(path);
  index->scan();
  cache_[key] = index;
  return index;
}

void DataStore::clear() {
  std::lock_guard<std::mutex> lock(mutex_);
  cache_.clear();
}

}
