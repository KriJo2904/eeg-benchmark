#pragma once

#include "analysis/analysis.h"

#include <cstddef>
#include <vector>

namespace eeg::analysis {

struct BenchPoint {
  std::size_t threads = 0;
  double ms = 0.0;
};

struct BenchResult {
  std::size_t hardware_concurrency = 0;
  int repeats = 0;
  std::size_t subjects = 0;
  std::size_t records_used = 0;
  std::size_t epochs = 0;
  std::vector<BenchPoint> runs;
};

std::vector<std::size_t> bench_thread_counts();

BenchResult run_benchmark(const eeg::pipeline::PipelineGraph& graph,
                          const std::vector<RecordJob>& jobs,
                          const std::vector<std::string>& channels, const EdfReader& reader,
                          int repeats = 3);

}
