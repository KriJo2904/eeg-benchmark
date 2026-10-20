#include "analysis/analysis.h"

#include "analysis/epochs.h"
#include "pipeline/parallel_for.h"

#include <chrono>
#include <cmath>
#include <mutex>
#include <stdexcept>

namespace eeg::analysis {

namespace {

using eeg::pipeline::PipelineGraph;
using eeg::pipeline::PipelineRunResult;

struct RecordPartial {
  std::map<std::string, CurveSum> curves;
  std::map<std::string, MapSum> maps;
  std::vector<BlockTime> blocks;
  std::vector<double> time_sec;
  std::vector<double> freq_hz;
  std::size_t epochs = 0;
};

std::string clean_label(std::string label) {
  while (!label.empty() && label.back() == '.') label.pop_back();
  return label;
}

void add_vector(std::vector<double>& sum, const std::vector<double>& x) {
  if (sum.empty()) sum.assign(x.size(), 0.0);
  const std::size_t n = std::min(sum.size(), x.size());
  for (std::size_t i = 0; i < n; ++i) sum[i] += x[i];
}

void merge_curve(CurveSum& into, const CurveSum& from) {
  if (into.power.empty()) into.power.resize(from.power.size());
  for (std::size_t c = 0; c < from.power.size() && c < into.power.size(); ++c) {
    add_vector(into.power[c], from.power[c]);
  }
  into.epochs += from.epochs;
}

void merge_map(MapSum& into, const MapSum& from) {
  if (into.power.empty()) into.power.resize(from.power.size());
  into.n_time = from.n_time;
  for (std::size_t c = 0; c < from.power.size() && c < into.power.size(); ++c) {
    add_vector(into.power[c], from.power[c]);
  }
  into.epochs += from.epochs;
}

void add_map_epoch(MapSum& into, const eeg::pipeline::Signal& out, const std::vector<std::size_t>& rows) {
  const std::size_t n_time = out.spectrograms[0].time_sec.size();
  if (into.power.empty()) {
    into.power.assign(out.spectrograms.size(), std::vector<double>(rows.size() * n_time, 0.0));
    into.n_time = n_time;
  }
  for (std::size_t c = 0; c < out.spectrograms.size() && c < into.power.size(); ++c) {
    const auto& spec = out.spectrograms[c];
    for (std::size_t r = 0; r < rows.size(); ++r) {
      for (std::size_t t = 0; t < n_time && t < spec.time_sec.size(); ++t) {
        into.power[c][r * n_time + t] += spec.power_at(rows[r], t);
      }
    }
  }
  ++into.epochs;
}

void check_pipeline(const PipelineGraph& graph) {
  const eeg::pipeline::GraphNode* fft = nullptr;
  bool has_band_power = false;
  bool seen_fft = false;
  for (const auto& id : eeg::pipeline::execution_order(graph)) {
    const eeg::pipeline::GraphNode* node = nullptr;
    for (const auto& n : graph.nodes) {
      if (n.id == id) node = &n;
    }
    if (!node) continue;

    if (node->kind == "fft") {
      fft = node;
      seen_fft = true;
    }
    if ((node->kind == "lowpass" || node->kind == "normalize") && seen_fft) {
      throw std::runtime_error("Blok „" + node->label + "” musi być przed blokiem „Transformacja Fouriera” " +
                               "- po STFT nie ma już próbek w czasie, które mógłby przetworzyć.");
    }
    if (node->kind == "band_power") {
      if (!seen_fft) {
        throw std::runtime_error("Blok „Moc pasma w czasie” musi być za blokiem „Transformacja Fouriera” (STFT).");
      }
      has_band_power = true;
    }
  }
  const auto order = eeg::pipeline::execution_order(graph);
  if (order.empty() || order.back() != "end") {
    throw std::runtime_error("Pipeline musi być jedną ścieżką od Start do Koniec - ostatni blok nie jest połączony z Koniec.");
  }
  if (!fft) throw std::runtime_error("Pipeline musi zawierać blok „Transformacja Fouriera” (STFT) połączony ze Start.");
  if (!has_band_power) throw std::runtime_error("Pipeline musi zawierać blok „Moc pasma w czasie” połączony ze Start.");

  const int window = fft->params.value("windowSize", 512);
  const int epoch_samples = static_cast<int>((kEpochPreSec + kEpochPostSec) * kSampleRateHz);
  if (window > epoch_samples / 4) {
    throw std::runtime_error("Okno STFT (" + std::to_string(window) + " próbek) jest za długie dla epoki " +
                             std::to_string(epoch_samples) + " próbek (5 s przy 160 Hz). " +
                             "Ustaw w bloku FFT najwyżej " + std::to_string(epoch_samples / 4) +
                             " (np. 128).");
  }
}

std::vector<std::size_t> map_rows(const eeg::pipeline::Signal& out) {
  std::vector<std::size_t> rows;
  const auto& freq = out.spectrograms[0].freq_hz;
  for (std::size_t f = 0; f < freq.size(); ++f) {
    if (freq[f] >= out.map_f_min && freq[f] <= out.map_f_max) rows.push_back(f);
  }
  return rows;
}

void add_epoch(RecordPartial& part, const std::string& event, const PipelineRunResult& run) {
  const auto& out = run.output;
  if (out.spectrograms.empty() || out.band_power.empty()) return;

  if (part.time_sec.empty()) {
    for (double t : out.spectrograms[0].time_sec) part.time_sec.push_back(t - kEpochPreSec);
    part.blocks.clear();
    for (const auto& n : run.nodes) part.blocks.push_back({n.kind, n.label, 0.0});
  }
  for (std::size_t i = 0; i < run.nodes.size() && i < part.blocks.size(); ++i) {
    part.blocks[i].ms += run.nodes[i].duration_ms;
  }

  merge_curve(part.curves[event], CurveSum{out.band_power, 1});

  if (out.map_f_max > 0.0) {
    const auto rows = map_rows(out);
    if (part.freq_hz.empty()) {
      for (std::size_t f : rows) part.freq_hz.push_back(out.spectrograms[0].freq_hz[f]);
    }
    add_map_epoch(part.maps[event], out, rows);
  }
  ++part.epochs;
}

RecordPartial process_record(const RecordJob& job, const PipelineGraph& graph,
                             const std::vector<std::string>& channels, const EdfReader& reader) {
  const auto signals = reader.read_channels(job.path, channels);
  if (signals.empty()) return {};
  if (std::abs(signals[0].sample_rate_hz - kSampleRateHz) > 0.5) {
    throw std::runtime_error("inna częstotliwość próbkowania (" +
                             std::to_string(static_cast<int>(signals[0].sample_rate_hz)) + " Hz)");
  }

  const bool baseline = task_types()[job.task_index].id == "baseline";
  const auto events = baseline ? std::vector<Event>{} : reader.read_events(job.path);

  RecordPartial part;
  for (auto& epoch : cut_epochs(signals, events, baseline)) {
    add_epoch(part, epoch.event, eeg::pipeline::run_pipeline(graph, std::move(epoch.signal)));
  }
  return part;
}

void merge_record(AnalysisResult& r, const RecordJob& job, const RecordPartial& part) {
  if (part.epochs == 0) {
    r.skipped.push_back(job.record_id + ": brak pełnych epok");
    return;
  }
  if (r.time_sec.empty()) {
    r.time_sec = part.time_sec;
    r.freq_hz = part.freq_hz;
    r.blocks = part.blocks;
    for (auto& b : r.blocks) b.ms = 0.0;
  }

  const std::string& task = task_types()[job.task_index].id;
  for (const auto& [event, curve] : part.curves) {
    merge_curve(r.curves[job.subject_id + "|" + task + "|" + event], curve);
  }
  for (const auto& [event, map] : part.maps) merge_map(r.maps[task + "|" + event], map);
  for (std::size_t i = 0; i < part.blocks.size() && i < r.blocks.size(); ++i) {
    r.blocks[i].ms += part.blocks[i].ms;
  }

  r.epochs += part.epochs;
  ++r.records_used;
}

void fill_ranges(AnalysisResult& r, const PipelineGraph& graph) {
  for (const auto& node : graph.nodes) {
    if (node.kind == "band_power") {
      r.band_f_min = node.params.value("fMin", 8.0);
      r.band_f_max = node.params.value("fMax", 13.0);
    }
  }
  r.has_map = !r.freq_hz.empty();
}

}

AnalysisResult run_analysis(const PipelineGraph& graph, const std::vector<RecordJob>& jobs,
                            const std::vector<std::string>& channels, const EdfReader& reader,
                            const AnalysisOptions& opt) {
  check_pipeline(graph);
  if (jobs.empty()) throw std::runtime_error("Brak rekordów dla wybranych badanych i zadań.");

  AnalysisResult result;
  for (const auto& ch : channels) result.channels.push_back(clean_label(ch));
  result.records_total = jobs.size();
  result.threads = eeg::pipeline::get_max_threads();

  std::mutex merge_mutex;
  std::atomic<std::size_t> done{0};
  const auto start = std::chrono::steady_clock::now();

  eeg::pipeline::parallel_for(jobs.size(), [&](std::size_t i) {
    if (opt.cancel && opt.cancel->load()) return;

    RecordPartial part;
    std::string error;
    try {
      part = process_record(jobs[i], graph, channels, reader);
    } catch (const std::exception& e) {
      error = e.what();
    }

    {
      std::lock_guard<std::mutex> lock(merge_mutex);
      if (!error.empty()) result.skipped.push_back(jobs[i].record_id + ": " + error);
      else merge_record(result, jobs[i], part);
    }

    const std::size_t n = ++done;
    if (opt.on_progress) opt.on_progress(n, jobs.size());
  });

  if (opt.cancel && opt.cancel->load()) throw std::runtime_error("Analiza została anulowana.");

  result.total_ms =
      std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count();
  fill_ranges(result, graph);

  if (result.records_used == 0) {
    std::string reason = result.skipped.empty() ? "" : " Np. " + result.skipped.front();
    throw std::runtime_error("Żaden rekord nie dał wyników." + reason);
  }
  return result;
}

std::vector<double> erd_percent(const std::vector<double>& mean_power,
                                const std::vector<double>& time_sec) {
  double baseline = 0.0;
  std::size_t n = 0;
  for (std::size_t i = 0; i < mean_power.size() && i < time_sec.size(); ++i) {
    if (time_sec[i] < 0.0) {
      baseline += mean_power[i];
      ++n;
    }
  }
  std::vector<double> erd(mean_power.size(), 0.0);
  if (n == 0 || baseline <= 0.0) return erd;
  baseline /= static_cast<double>(n);

  for (std::size_t i = 0; i < mean_power.size(); ++i) {
    erd[i] = (mean_power[i] - baseline) / baseline * 100.0;
  }
  return erd;
}

}
