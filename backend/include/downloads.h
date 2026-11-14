#pragma once

#include "data_store.h"

#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

namespace eeg {

struct DownloadInfo {
  int id = 0;
  std::string url;
  std::string name;
  std::string state;
  std::string error;
  std::uintmax_t bytes = 0;
  std::uintmax_t total = 0;
};

class Downloads {
 public:
  explicit Downloads(DataStore& store);

  int start(const std::string& url, const std::string& name);
  std::vector<DownloadInfo> list();
  void cancel_or_remove(int id);

 private:
  struct Job;

  void run(std::shared_ptr<Job> job);

  DataStore& store_;
  std::mutex mutex_;
  std::vector<std::shared_ptr<Job>> jobs_;
  int next_id_ = 1;
};

}
