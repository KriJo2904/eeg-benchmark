#pragma once

#include "analysis/selection.h"
#include "edf_reader.h"
#include "pipeline/pipeline.h"

#include <atomic>
#include <functional>
#include <map>
#include <string>
#include <vector>

namespace eeg::analysis {

constexpr double kSampleRateHz = 160.0;

struct CurveSum {
  std::vector<std::vector<double>> power;
  std::size_t epochs = 0;
};

struct MapSum {
  std::vector<std::vector<double>> power;
  std::size_t n_time = 0;
  std::size_t epochs = 0;
};

struct BlockTime {
  std::string kind;
  std::string label;
  double ms = 0.0;
};

struct AnalysisResult {
  std::vector<std::string> channels;
  std::vector<double> time_sec;
  std::vector<double> freq_hz;
  double band_f_min = 0.0;
  double band_f_max = 0.0;
  bool has_map = false;

  std::map<std::string, CurveSum> curves;
  std::map<std::string, MapSum> maps;

  std::size_t records_total = 0;
  std::size_t records_used = 0;
  std::vector<std::string> skipped;
  std::size_t epochs = 0;
  std::size_t threads = 0;
  double total_ms = 0.0;
  std::vector<BlockTime> blocks;
};

struct AnalysisOptions {
  std::function<void(std::size_t, std::size_t)> on_progress;
  std::atomic<bool>* cancel = nullptr;
};

AnalysisResult run_analysis(const eeg::pipeline::PipelineGraph& graph,
                            const std::vector<RecordJob>& jobs,
                            const std::vector<std::string>& channels, const EdfReader& reader,
                            const AnalysisOptions& opt = {});

std::vector<double> erd_percent(const std::vector<double>& mean_power,
                                const std::vector<double>& time_sec);

nlohmann::json to_documents(const AnalysisResult& r, const Selection& sel);

}
