#include "analysis/benchmark.h"

#include "pipeline/parallel_for.h"

#include <algorithm>
#include <sstream>
#include <stdexcept>

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

double measure_ms(const eeg::pipeline::PipelineGraph& graph, const AnalysisSettings& settings,
                  const std::vector<RecordJob>& jobs,
                  const std::vector<std::string>& channels, const EdfReader& reader,
                  std::size_t threads, int repeats) {
  AnalysisOptions opt;
  opt.threads = threads;
  std::vector<double> times;
  for (int r = 0; r < repeats; ++r) {
    times.push_back(run_analysis(graph, settings, jobs, channels, reader, opt).total_ms);
  }
  return median(times);
}

std::size_t parse_number(const std::string& text, std::size_t max, const std::string& what) {
  const bool digits = !text.empty() && text.size() <= 4 &&
                      text.find_first_not_of("0123456789") == std::string::npos;
  const std::size_t n = digits ? std::stoul(text) : 0;
  if (n < 1 || n > max) {
    throw std::runtime_error("Nieprawidłowa liczba " + what + ": " + text + " (dozwolone od 1 do " +
                             std::to_string(max) + ").");
  }
  return n;
}

bool by_threads(const BenchVariant& a, const BenchVariant& b) { return a.threads < b.threads; }

}

std::vector<BenchVariant> default_bench_variants(int repeats) {
  std::vector<BenchVariant> variants = {{1, repeats}, {2, repeats}, {4, repeats}};
  const std::size_t hw = eeg::pipeline::default_threads();
  if (hw != 1 && hw != 2 && hw != 4) variants.push_back({hw, repeats});
  std::sort(variants.begin(), variants.end(), by_threads);
  return variants;
}

std::vector<BenchVariant> parse_bench_variants(const std::string& text, int default_repeats) {
  std::vector<BenchVariant> variants;
  bool has_one = false;
  std::stringstream in(text);
  std::string item;
  while (std::getline(in, item, ',')) {
    item.erase(std::remove(item.begin(), item.end(), ' '), item.end());
    if (item.empty()) continue;

    BenchVariant v;
    v.repeats = default_repeats;
    const std::size_t colon = item.find(':');
    if (colon == std::string::npos) {
      v.threads = parse_number(item, kMaxThreads, "wątków");
    } else {
      v.threads = parse_number(item.substr(0, colon), kMaxThreads, "wątków");
      v.repeats = static_cast<int>(parse_number(item.substr(colon + 1), kMaxRepeats, "przebiegów"));
    }

    for (const BenchVariant& other : variants) {
      if (other.threads == v.threads) {
        throw std::runtime_error("Wariant " + std::to_string(v.threads) + " wątków jest wpisany dwa razy.");
      }
    }
    if (v.threads == 1) has_one = true;
    variants.push_back(v);
  }
  if (!has_one) variants.push_back({1, default_repeats});
  std::sort(variants.begin(), variants.end(), by_threads);
  return variants;
}

BenchResult run_benchmark(const eeg::pipeline::PipelineGraph& graph,
                          const AnalysisSettings& settings, const std::vector<RecordJob>& jobs,
                          const std::vector<std::string>& channels, const EdfReader& reader,
                          const std::vector<BenchVariant>& variants) {
  BenchResult result;
  result.hardware_concurrency = eeg::pipeline::default_threads();
  result.subjects = count_subjects(jobs);

  const AnalysisResult warmup = run_analysis(graph, settings, jobs, channels, reader);
  result.records_used = warmup.records_used;
  result.epochs = warmup.epochs;

  for (const BenchVariant& v : variants) {
    const int repeats = std::clamp(v.repeats, 1, kMaxRepeats);
    result.runs.push_back({v.threads, repeats,
                           measure_ms(graph, settings, jobs, channels, reader, v.threads, repeats)});
  }
  return result;
}

}
