#pragma once

#include <condition_variable>
#include <cstddef>
#include <functional>
#include <mutex>
#include <queue>
#include <thread>
#include <vector>

namespace eeg::pipeline {

class ThreadPool {
 public:
  explicit ThreadPool(std::size_t n_threads);
  ~ThreadPool();

  ThreadPool(const ThreadPool&) = delete;
  ThreadPool& operator=(const ThreadPool&) = delete;

  void submit(std::function<void()> task);

  void wait_all();

  std::size_t size() const { return workers_.size(); }

 private:
  void worker_loop();

  std::vector<std::thread> workers_;
  std::queue<std::function<void()>> tasks_;

  std::mutex mutex_;
  std::condition_variable task_ready_;
  std::condition_variable all_done_;

  std::size_t active_ = 0;
  bool stop_ = false;
};

}
