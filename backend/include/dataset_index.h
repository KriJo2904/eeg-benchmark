#pragma once

#include <filesystem>
#include <string>
#include <vector>

namespace eeg {

struct RecordRef {
  std::string id;
  std::string path;
};

class DatasetIndex {
 public:
  explicit DatasetIndex(std::filesystem::path root);

  void scan();

  std::vector<RecordRef> list_records() const;
  std::vector<std::string> list_subjects() const;
  std::vector<RecordRef> list_records_for_subject(const std::string& subject_id) const;
  std::filesystem::path resolve_path(const std::string& id) const;

 private:
  std::filesystem::path root_;
  std::vector<std::string> records_;
};

}
