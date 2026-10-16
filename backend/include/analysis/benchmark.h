#pragma once

#include "analysis/analysis.h"

#include <cstddef>
#include <string>
#include <vector>

namespace eeg::analysis {

constexpr int kMaxRepeats = 20;
constexpr std::size_t kMaxThreads = 1024;

struct BenchVariant {
  std::size_t threads = 0;
  int repeats = 0;
};

struct BenchPoint {
  std::size_t threads = 0;
  int repeats = 0;
  double ms = 0.0;
};

struct BenchResult {
  std::size_t hardware_concurrency = 0;
  std::size_t subjects = 0;
  std::size_t records_used = 0;
  std::size_t epochs = 0;
  std::vector<BenchPoint> runs;
};

std::vector<BenchVariant> default_bench_variants(int repeats);

std::vector<BenchVariant> parse_bench_variants(const std::string& text, int default_repeats);

BenchResult run_benchmark(const eeg::pipeline::PipelineGraph& graph,
                          const AnalysisSettings& settings, const std::vector<RecordJob>& jobs,
                          const std::vector<std::string>& channels, const EdfReader& reader,
                          const std::vector<BenchVariant>& variants);

}
