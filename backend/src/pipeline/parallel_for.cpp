#include "pipeline/parallel_for.h"

#include "pipeline/thread_pool.h"

#include <algorithm>
#include <atomic>
#include <memory>
#include <mutex>
#include <thread>

namespace eeg::pipeline {

namespace {

std::atomic<std::size_t> g_max_threads{0};

std::unique_ptr<ThreadPool> g_pool;

std::mutex g_pool_mutex;

thread_local bool t_inside_task = false;

void run_range(const std::function<void(std::size_t)>& fn, std::size_t begin, std::size_t end) {
  const bool previous = t_inside_task;
  t_inside_task = true;
  for (std::size_t i = begin; i < end; ++i) fn(i);
  t_inside_task = previous;
}

}

void set_max_threads(std::size_t n) { g_max_threads.store(n); }

std::size_t get_max_threads() {
  std::size_t n = g_max_threads.load();
  if (n == 0) n = std::max<std::size_t>(1, std::thread::hardware_concurrency());
  return n;
}

void parallel_for(std::size_t count, const std::function<void(std::size_t)>& fn) {
  if (count == 0) return;

  if (t_inside_task) {
    for (std::size_t i = 0; i < count; ++i) fn(i);
    return;
  }

  std::lock_guard<std::mutex> lock(g_pool_mutex);
  const std::size_t n_threads = get_max_threads();

  if (n_threads <= 1 || count == 1) {
    run_range(fn, 0, count);
    return;
  }

  if (!g_pool || g_pool->size() != n_threads) {
    g_pool = std::make_unique<ThreadPool>(n_threads);
  }

  const std::size_t n_chunks = std::min(count, 4 * n_threads);
  for (std::size_t c = 0; c < n_chunks; ++c) {
    const std::size_t begin = c * count / n_chunks;
    const std::size_t end = (c + 1) * count / n_chunks;
    g_pool->submit([&fn, begin, end] { run_range(fn, begin, end); });
  }

  g_pool->wait_all();
}

}
