#include "pipeline/stft.h"

#include "pipeline/fft_utils.h"
#include "pipeline/parallel_for.h"

#include <algorithm>
#include <cmath>

namespace eeg::pipeline {

namespace {

struct StftTask {
  std::size_t channel_idx;
  std::size_t frame_idx;
};

ChannelSpectrogram prepare_spectrogram(const ChannelSeries& ch, int window_size, int step) {
  ChannelSpectrogram spec;
  spec.label = ch.label;

  const int n = static_cast<int>(ch.samples.size());
  if (n < window_size || ch.sample_rate_hz <= 0.0) return spec;

  const int n_bins = window_size / 2 + 1;
  spec.freq_hz.resize(n_bins);
  for (int b = 0; b < n_bins; ++b) spec.freq_hz[b] = b * ch.sample_rate_hz / window_size;

  for (int start = 0; start + window_size <= n; start += step) {
    const double center_sample = start + window_size / 2.0;
    spec.time_sec.push_back(center_sample / ch.sample_rate_hz);
  }

  spec.power.assign(static_cast<std::size_t>(n_bins) * spec.time_sec.size(), 0.0);
  return spec;
}

void compute_frame(const ChannelSeries& ch, ChannelSpectrogram& spec, std::size_t frame_idx,
                   int step, const std::vector<double>& window_fn, const RealFft& fft) {
  const std::size_t window_size = window_fn.size();
  const std::size_t start = frame_idx * static_cast<std::size_t>(step);

  thread_local std::vector<double> frame;
  thread_local std::vector<double> power;
  frame.resize(window_size);

  for (std::size_t i = 0; i < window_size; ++i) frame[i] = ch.samples[start + i] * window_fn[i];

  fft.power(frame, power);
  for (std::size_t b = 0; b < power.size(); ++b) spec.power_at(b, frame_idx) = power[b];
}

}

std::vector<ChannelSpectrogram> compute_stft_all(const std::vector<ChannelSeries>& channels,
                                                 int window_size, double overlap) {
  window_size = std::max(2, window_size);
  overlap = std::clamp(overlap, 0.0, 0.95);
  const int step = std::max(1, static_cast<int>(std::round(window_size * (1.0 - overlap))));

  const auto window_fn = hann_window(static_cast<std::size_t>(window_size));
  const RealFft fft(static_cast<std::size_t>(window_size));

  std::vector<ChannelSpectrogram> specs(channels.size());
  std::vector<StftTask> tasks;
  for (std::size_t c = 0; c < channels.size(); ++c) {
    specs[c] = prepare_spectrogram(channels[c], window_size, step);
    for (std::size_t f = 0; f < specs[c].time_sec.size(); ++f) tasks.push_back({c, f});
  }

  parallel_for(tasks.size(), [&](std::size_t i) {
    const StftTask& t = tasks[i];
    compute_frame(channels[t.channel_idx], specs[t.channel_idx], t.frame_idx, step, window_fn,
                  fft);
  });

  return specs;
}

}
