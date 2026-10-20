#include "dataset_index.h"

#include <algorithm>
#include <cctype>

namespace eeg {

static bool is_edf(const std::filesystem::path& p) {
  auto ext = p.extension().string();
  std::transform(ext.begin(), ext.end(), ext.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  return ext == ".edf";
}

DatasetIndex::DatasetIndex(std::filesystem::path root) : root_(std::move(root)) {}

void DatasetIndex::scan() {
  if (root_.empty() || !std::filesystem::exists(root_)) {
    std::scoped_lock lk(mu_);
    records_.clear();
    return;
  }

  std::vector<std::string> found;
  for (const auto& entry : std::filesystem::recursive_directory_iterator(root_)) {
    if (!entry.is_regular_file()) continue;
    if (!is_edf(entry.path())) continue;
    found.push_back(std::filesystem::relative(entry.path(), root_).generic_string());
  }
  std::sort(found.begin(), found.end());

  std::scoped_lock lk(mu_);
  records_ = std::move(found);
}

std::vector<RecordRef> DatasetIndex::list_records() const {
  std::scoped_lock lk(mu_);
  std::vector<RecordRef> out;
  out.reserve(records_.size());
  for (const auto& rel : records_) {
    out.push_back({rel, (root_ / rel).string()});
  }
  return out;
}

std::vector<std::string> DatasetIndex::list_subjects() const {
  std::scoped_lock lk(mu_);
  std::vector<std::string> subjects;
  for (const auto& rel : records_) {
    auto slash = rel.find('/');
    if (slash == std::string::npos) continue;
    auto s = rel.substr(0, slash);
    if (subjects.empty() || subjects.back() != s) subjects.push_back(std::move(s));
  }
  return subjects;
}

std::vector<RecordRef> DatasetIndex::list_records_for_subject(const std::string& subject_id) const {
  std::scoped_lock lk(mu_);
  const std::string prefix = subject_id + "/";
  std::vector<RecordRef> out;
  for (const auto& rel : records_) {
    if (rel.rfind(prefix, 0) != 0) continue;
    out.push_back({rel, (root_ / rel).string()});
  }
  return out;
}

std::filesystem::path DatasetIndex::resolve_path(const std::string& id) const {
  std::scoped_lock lk(mu_);
  return root_ / id;
}

}
