#include "edf_reader.h"
#include "pipeline/parallel_for.h"
#include "pipeline/stft.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace {

using eeg::pipeline::ChannelSeries;
using eeg::pipeline::ChannelSpectrogram;

std::vector<std::string> split_csv(const std::string& s) {
  std::vector<std::string> out;
  std::istringstream ss(s);
  for (std::string tok; std::getline(ss, tok, ',');) {
    if (!tok.empty()) out.push_back(tok);
  }
  return out;
}

std::vector<ChannelSeries> load_channels(const std::filesystem::path& path,
                                         const std::string& channels_arg, double t0, double t1) {
  eeg::EdfReader reader;
  const auto meta = reader.read_metadata(path, path.filename().string());

  std::vector<std::string> wanted;
  if (channels_arg == "all") {
    for (const auto& c : meta.channels) wanted.push_back(c.label);
  } else {
    wanted = split_csv(channels_arg);
  }

  std::vector<ChannelSeries> channels;
  for (const auto& name : wanted) {
    const auto w = reader.read_window(path, name, t0, t1,1);
    channels.push_back({w.channel_label, w.sample_rate_hz, w.samples});
  }
  return channels;
}

std::size_t argmax(const std::vector<double>& v) {
  return static_cast<std::size_t>(std::max_element(v.begin(), v.end()) - v.begin());
}

bool self_test() {
  const double fs = 160.0;
  const double f_sin = 10.0;
  ChannelSeries sine{"sin10Hz", fs, {}};
  for (int i = 0; i < 160 * 5; ++i) sine.samples.push_back(std::sin(2.0 * M_PI * f_sin * i / fs));
  const std::vector<ChannelSeries> input = {sine, sine, sine};

  eeg::pipeline::set_max_threads(1);
  const auto seq = eeg::pipeline::compute_stft_all(input, 160, 0.5);
  eeg::pipeline::set_max_threads(0);
  const auto par = eeg::pipeline::compute_stft_all(input, 160, 0.5);

  for (const auto& spec : seq) {
    for (std::size_t t = 0; t < spec.time_sec.size(); ++t) {
      std::vector<double> column;
      for (std::size_t b = 0; b < spec.freq_hz.size(); ++b) column.push_back(spec.power_at(b, t));
      if (std::abs(spec.freq_hz[argmax(column)] - f_sin) > 1e-9) return false;
    }
  }

  for (std::size_t c = 0; c < seq.size(); ++c) {
    if (seq[c].power != par[c].power) return false;
  }
  return true;
}

double median(std::vector<double> v) {
  std::sort(v.begin(), v.end());
  const std::size_t n = v.size();
  return (n % 2 == 1) ? v[n / 2] : (v[n / 2 - 1] + v[n / 2]) / 2.0;
}

double measure(const std::vector<ChannelSeries>& channels, int window_size, double overlap,
               std::size_t threads, int repeats) {
  eeg::pipeline::set_max_threads(threads);
  (void)eeg::pipeline::compute_stft_all(channels, window_size, overlap);

  std::vector<double> times;
  for (int r = 0; r < repeats; ++r) {
    const auto start = std::chrono::steady_clock::now();
    (void)eeg::pipeline::compute_stft_all(channels, window_size, overlap);
    const auto stop = std::chrono::steady_clock::now();
    times.push_back(std::chrono::duration<double, std::milli>(stop - start).count());
  }
  return median(times);
}

}

int main(int argc, char** argv) {
  if (argc < 7) {
    std::cerr << "Uzycie: bench_pipeline <plik.edf> <kanaly|all> <t0> <t1> <windowSize> <overlap> "
                 "[powtorzenia=5]\n";
    return 2;
  }

  const std::filesystem::path path = argv[1];
  const std::string channels_arg = argv[2];
  const double t0 = std::stod(argv[3]);
  const double t1 = std::stod(argv[4]);
  const int window_size = std::stoi(argv[5]);
  const double overlap = std::stod(argv[6]);
  const int repeats = std::max(1, (argc >= 8) ? std::stoi(argv[7]) : 5);

  if (!self_test()) {
    std::cerr << "BLAD: test STFT na sinusoidzie 10 Hz nie przeszedl\n";
    return 1;
  }
  std::cout << "test STFT (sinus 10 Hz, 1 vs N watkow): OK\n";

  try {
    const auto channels = load_channels(path, channels_arg, t0, t1);
    std::cout << "plik: " << path.string() << ", kanaly: " << channels.size()
              << ", okno: " << window_size << ", overlap: " << overlap << "\n";

    const std::size_t hw = std::max<std::size_t>(1, std::thread::hardware_concurrency());
    std::vector<std::size_t> thread_counts = {1, 2, 4, hw};
    std::sort(thread_counts.begin(), thread_counts.end());
    thread_counts.erase(std::unique(thread_counts.begin(), thread_counts.end()), thread_counts.end());

    std::ofstream csv("bench_results.csv");
    csv << "threads,median_ms,speedup,efficiency\n";

    double baseline_ms = 0.0;
    for (auto t : thread_counts) {
      const double ms = measure(channels, window_size, overlap, t, repeats);
      if (t == 1) baseline_ms = ms;

      const double speedup = (ms > 0.0) ? baseline_ms / ms : 0.0;
      const double efficiency = speedup / static_cast<double>(t);

      std::cout << "watki: " << t << "  czas: " << ms << " ms  speedup: " << speedup
                << "x  efektywnosc: " << efficiency << "\n";
      csv << t << "," << ms << "," << speedup << "," << efficiency << "\n";
    }
    std::cout << "zapisano bench_results.csv\n";
  } catch (const std::exception& e) {
    std::cerr << "error: " << e.what() << "\n";
    return 1;
  }

  return 0;
}
