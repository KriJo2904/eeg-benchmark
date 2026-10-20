#include "analysis/benchmark.h"

#include "pipeline/parallel_for.h"

#include <algorithm>
#include <thread>

namespace eeg::analysis {

namespace {

double median(std::vector<double> v) {
  std::sort(v.begin(), v.end());
  const std::size_t n = v.size();
  return (n % 2 == 1) ? v[n / 2] : (v[n / 2 - 1] + v[n / 2]) / 2.0;
}

std::size_t count_subjects(const std::vector<RecordJob>& jobs) {
  std::size_t n = 0;
  for (std::size_t i = 0; i < jobs.size(); ++i) {
    if (i == 0 || jobs[i].subject_id != jobs[i - 1].subject_id) ++n;
  }
  return n;
}

double measure_ms(const eeg::pipeline::PipelineGraph& graph, const std::vector<RecordJob>& jobs,
                  const std::vector<std::string>& channels, const EdfReader& reader,
                  std::size_t threads, int repeats) {
  eeg::pipeline::set_max_threads(threads);
  std::vector<double> times;
  for (int r = 0; r < repeats; ++r) {
    times.push_back(run_analysis(graph, jobs, channels, reader).total_ms);
  }
  return median(times);
}

}

std::vector<std::size_t> bench_thread_counts() {
  const std::size_t hw = std::max<std::size_t>(1, std::thread::hardware_concurrency());
  std::vector<std::size_t> counts = {1, 2, 4, hw};
  std::sort(counts.begin(), counts.end());
  counts.erase(std::unique(counts.begin(), counts.end()), counts.end());
  return counts;
}

BenchResult run_benchmark(const eeg::pipeline::PipelineGraph& graph,
                          const std::vector<RecordJob>& jobs,
                          const std::vector<std::string>& channels, const EdfReader& reader,
                          int repeats) {
  BenchResult result;
  result.hardware_concurrency = std::max<std::size_t>(1, std::thread::hardware_concurrency());
  result.repeats = std::max(1, repeats);
  result.subjects = count_subjects(jobs);

  eeg::pipeline::set_max_threads(0);
  const AnalysisResult warmup = run_analysis(graph, jobs, channels, reader);
  result.records_used = warmup.records_used;
  result.epochs = warmup.epochs;

  for (std::size_t t : bench_thread_counts()) {
    result.runs.push_back({t, measure_ms(graph, jobs, channels, reader, t, result.repeats)});
  }

  eeg::pipeline::set_max_threads(0);
  return result;
}

}
