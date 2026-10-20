#include "pipeline/thread_pool.h"

#include <utility>

namespace eeg::pipeline {

ThreadPool::ThreadPool(std::size_t n_threads) {
  if (n_threads == 0) n_threads = 1;
  workers_.reserve(n_threads);
  for (std::size_t i = 0; i < n_threads; ++i) {
    workers_.emplace_back([this] { worker_loop(); });
  }
}

ThreadPool::~ThreadPool() {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    stop_ = true;
  }
  task_ready_.notify_all();
  for (auto& w : workers_) w.join();
}

void ThreadPool::submit(std::function<void()> task) {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    tasks_.push(std::move(task));
  }
  task_ready_.notify_one();
}

void ThreadPool::wait_all() {
  std::unique_lock<std::mutex> lock(mutex_);
  all_done_.wait(lock, [this] { return tasks_.empty() && active_ == 0; });
}

void ThreadPool::worker_loop() {
  while (true) {
    std::function<void()> task;
    {
      std::unique_lock<std::mutex> lock(mutex_);
      task_ready_.wait(lock, [this] { return stop_ || !tasks_.empty(); });
      if (stop_ && tasks_.empty()) return;

      task = std::move(tasks_.front());
      tasks_.pop();
      ++active_;
    }

    task();

    {
      std::lock_guard<std::mutex> lock(mutex_);
      --active_;
      if (tasks_.empty() && active_ == 0) all_done_.notify_all();
    }
  }
}

}
