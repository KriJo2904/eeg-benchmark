#include "analysis/analysis.h"

#include "analysis/epochs.h"
#include "pipeline/parallel_for.h"

#include <chrono>
#include <cmath>
#include <sstream>
#include <stdexcept>
#include <thread>

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
  const auto order = eeg::pipeline::execution_order(graph);
  const eeg::pipeline::GraphNode* fft = nullptr;
  for (const auto& id : order) {
    const eeg::pipeline::GraphNode* node = nullptr;
    for (const auto& n : graph.nodes) {
      if (n.id == id) node = &n;
    }
    if (!node) continue;

    if (node->kind == "fft") fft = node;
    if ((node->kind == "lowpass" || node->kind == "normalize") && fft) {
      throw std::runtime_error("Blok „" + node->label + "” musi być przed blokiem „Transformacja Fouriera” " +
                               "- po STFT nie ma już próbek w czasie, które mógłby przetworzyć.");
    }
  }
  if (order.empty() || order.back() != "end") {
    throw std::runtime_error("Pipeline musi być jedną ścieżką od Start do Koniec - ostatni blok nie jest połączony z Koniec.");
  }
  if (!fft) throw std::runtime_error("Pipeline musi zawierać blok „Transformacja Fouriera” (STFT) połączony ze Start.");

  const int window = fft->params.value("windowSize", 128);
  const int epoch_samples = static_cast<int>((kEpochPreSec + kEpochPostSec) * kSampleRateHz);
  if (window > epoch_samples / 4) {
    throw std::runtime_error("Okno STFT (" + std::to_string(window) + " próbek) jest za długie dla epoki " +
                             std::to_string(epoch_samples) + " próbek (5 s przy 160 Hz). " +
                             "Ustaw w bloku FFT najwyżej " + std::to_string(epoch_samples / 4) +
                             " (np. 128).");
  }
}

std::vector<std::size_t> rows_in_range(const std::vector<double>& freq, double f_min, double f_max) {
  std::vector<std::size_t> rows;
  for (std::size_t f = 0; f < freq.size(); ++f) {
    if (freq[f] >= f_min && freq[f] <= f_max) rows.push_back(f);
  }
  return rows;
}

std::vector<std::vector<double>> band_power(const std::vector<eeg::pipeline::ChannelSpectrogram>& specs,
                                            const AnalysisSettings& settings) {
  std::vector<std::vector<double>> result;
  for (const auto& spec : specs) {
    const auto rows = rows_in_range(spec.freq_hz, settings.band_f_min, settings.band_f_max);
    std::vector<double> power(spec.time_sec.size(), 0.0);
    for (std::size_t t = 0; t < power.size() && !rows.empty(); ++t) {
      double sum = 0.0;
      for (std::size_t f : rows) sum += spec.power_at(f, t);
      power[t] = sum / static_cast<double>(rows.size());
    }
    result.push_back(power);
  }
  return result;
}

void add_epoch(RecordPartial& part, const std::string& event, const PipelineRunResult& run,
               const AnalysisSettings& settings) {
  const auto& out = run.output;
  if (out.spectrograms.empty()) return;

  if (part.time_sec.empty()) {
    for (double t : out.spectrograms[0].time_sec) part.time_sec.push_back(t - kEpochPreSec);
    part.blocks.clear();
    for (const auto& n : run.nodes) part.blocks.push_back({n.kind, n.label, 0.0});
  }
  for (std::size_t i = 0; i < run.nodes.size() && i < part.blocks.size(); ++i) {
    part.blocks[i].ms += run.nodes[i].duration_ms;
  }

  merge_curve(part.curves[event], CurveSum{band_power(out.spectrograms, settings), 1});

  const auto& freq = out.spectrograms[0].freq_hz;
  const auto rows = rows_in_range(freq, settings.map_f_min, settings.map_f_max);
  if (part.freq_hz.empty()) {
    for (std::size_t f : rows) part.freq_hz.push_back(freq[f]);
  }
  add_map_epoch(part.maps[event], out, rows);
  ++part.epochs;
}

RecordPartial process_record(const RecordJob& job, const PipelineGraph& graph,
                             const AnalysisSettings& settings,
                             const std::vector<std::string>& channels, const EdfReader& reader) {
  const EdfRecord record = reader.read_record(job.path, channels);
  const auto& signals = record.signals;
  if (signals.empty()) return {};
  if (std::abs(signals[0].sample_rate_hz - kSampleRateHz) > 0.5) {
    throw std::runtime_error("inna częstotliwość próbkowania (" +
                             std::to_string(static_cast<int>(signals[0].sample_rate_hz)) + " Hz)");
  }

  const bool baseline = task_types()[job.task_index].id == "baseline";
  const auto events = baseline ? std::vector<Event>{} : record.events;

  RecordPartial part;
  for (auto& epoch : cut_epochs(signals, events, baseline)) {
    add_epoch(part, epoch.event, eeg::pipeline::run_pipeline(graph, std::move(epoch.signal)), settings);
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

struct AnalysisInput {
  const PipelineGraph& graph;
  const AnalysisSettings& settings;
  const std::vector<RecordJob>& jobs;
  const std::vector<std::string>& channels;
  const EdfReader& reader;
  std::atomic<bool>* cancel;
};

void process_range(const AnalysisInput& in, std::size_t begin, std::size_t end,
                   AnalysisResult& out, std::atomic<std::size_t>& done) {
  for (std::size_t i = begin; i < end; ++i) {
    if (in.cancel && in.cancel->load()) return;
    const RecordJob& job = in.jobs[i];
    try {
      merge_record(out, job, process_record(job, in.graph, in.settings, in.channels, in.reader));
    } catch (const std::exception& e) {
      out.skipped.push_back(job.record_id + ": " + e.what());
    }
    ++done;
  }
}

void merge_partial(AnalysisResult& into, const AnalysisResult& from) {
  into.skipped.insert(into.skipped.end(), from.skipped.begin(), from.skipped.end());
  if (from.records_used == 0) return;

  if (into.time_sec.empty()) {
    into.time_sec = from.time_sec;
    into.freq_hz = from.freq_hz;
    into.blocks = from.blocks;
  } else {
    for (std::size_t i = 0; i < from.blocks.size() && i < into.blocks.size(); ++i) {
      into.blocks[i].ms += from.blocks[i].ms;
    }
  }
  for (const auto& [key, curve] : from.curves) merge_curve(into.curves[key], curve);
  for (const auto& [key, map] : from.maps) merge_map(into.maps[key], map);
  into.epochs += from.epochs;
  into.records_used += from.records_used;
}

void report_progress(const AnalysisOptions& opt, const std::atomic<std::size_t>& done,
                     std::size_t total) {
  if (!opt.on_progress) return;
  std::size_t last = 0;
  while (done.load() < total) {
    if (opt.cancel && opt.cancel->load()) return;
    const std::size_t now = done.load();
    if (now != last) {
      opt.on_progress(now, total);
      last = now;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(20));
  }
  opt.on_progress(total, total);
}

void read_range(const nlohmann::json& j, double& f_min, double& f_max) {
  if (!j.is_object()) return;
  f_min = j.value("fMin", f_min);
  f_max = j.value("fMax", f_max);
}

void check_range(double f_min, double f_max, const std::string& what) {
  if (!(f_min >= 0.0 && f_max <= kSampleRateHz / 2.0 && f_min < f_max)) {
    std::ostringstream msg;
    msg << what << ": zakres " << f_min << "–" << f_max
        << " Hz jest nieprawidłowy. Musi być od 0 do 80 Hz, a początek mniejszy od końca.";
    throw std::runtime_error(msg.str());
  }
}

}

AnalysisSettings parse_settings(const nlohmann::json& pipeline) {
  AnalysisSettings s;
  for (const auto& n : pipeline.value("nodes", nlohmann::json::array())) {
    const auto data = n.value("data", nlohmann::json::object());
    const auto params = data.value("params", nlohmann::json::object());
    const std::string kind = data.value("kind", std::string{});
    if (kind == "band_power") read_range(params, s.band_f_min, s.band_f_max);
    if (kind == "spektrogram") read_range(params, s.map_f_min, s.map_f_max);
  }
  const auto analysis = pipeline.value("analysis", nlohmann::json::object());
  read_range(analysis.value("band", nlohmann::json::object()), s.band_f_min, s.band_f_max);
  read_range(analysis.value("map", nlohmann::json::object()), s.map_f_min, s.map_f_max);

  check_range(s.band_f_min, s.band_f_max, "Pasmo ERD");
  check_range(s.map_f_min, s.map_f_max, "Mapa ERD");
  return s;
}

AnalysisResult run_analysis(const PipelineGraph& graph, const AnalysisSettings& settings,
                            const std::vector<RecordJob>& jobs,
                            const std::vector<std::string>& channels, const EdfReader& reader,
                            const AnalysisOptions& opt) {
  check_pipeline(graph);
  if (jobs.empty()) throw std::runtime_error("Brak rekordów dla wybranych badanych i zadań.");

  AnalysisResult result;
  for (const auto& ch : channels) result.channels.push_back(clean_label(ch));
  result.records_total = jobs.size();
  result.threads = opt.threads > 0 ? opt.threads : eeg::pipeline::default_threads();

  const AnalysisInput input{graph, settings, jobs, channels, reader, opt.cancel};
  std::vector<AnalysisResult> partials(result.threads);
  std::atomic<std::size_t> done{0};
  const auto start = std::chrono::steady_clock::now();

  std::vector<std::thread> threads;
  for (std::size_t t = 0; t < result.threads; ++t) {
    const std::size_t begin = eeg::pipeline::range_begin(jobs.size(), result.threads, t);
    const std::size_t end = eeg::pipeline::range_begin(jobs.size(), result.threads, t + 1);
    threads.emplace_back(process_range, std::cref(input), begin, end, std::ref(partials[t]),
                         std::ref(done));
  }
  report_progress(opt, done, jobs.size());
  for (std::thread& t : threads) t.join();

  for (const AnalysisResult& part : partials) merge_partial(result, part);

  if (opt.cancel && opt.cancel->load()) throw std::runtime_error("Analiza została anulowana.");

  result.total_ms =
      std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count();
  result.band_f_min = settings.band_f_min;
  result.band_f_max = settings.band_f_max;

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
