#include "pipeline/parallel_for.h"

#include <algorithm>
#include <thread>
#include <vector>

namespace eeg::pipeline {

namespace {

void run_range(const std::function<void(std::size_t)>& fn, std::size_t begin, std::size_t end) {
  for (std::size_t i = begin; i < end; ++i) fn(i);
}

}

std::size_t default_threads() {
  return std::max<std::size_t>(1, std::thread::hardware_concurrency());
}

std::size_t range_begin(std::size_t count, std::size_t n_parts, std::size_t part) {
  return part * count / n_parts;
}

void parallel_for(std::size_t count, std::size_t n_threads,
                  const std::function<void(std::size_t)>& fn) {
  n_threads = std::min(n_threads, count);
  if (n_threads <= 1) {
    run_range(fn, 0, count);
    return;
  }

  std::vector<std::thread> threads;
  for (std::size_t t = 0; t < n_threads; ++t) {
    const std::size_t begin = range_begin(count, n_threads, t);
    const std::size_t end = range_begin(count, n_threads, t + 1);
    threads.emplace_back(run_range, std::cref(fn), begin, end);
  }
  for (std::thread& t : threads) t.join();
}

}
