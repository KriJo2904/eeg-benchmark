#include "analysis/epochs.h"

#include <cmath>

namespace eeg::analysis {

namespace {

Epoch make_epoch(const std::vector<SignalWindow>& channels, const std::string& event,
                 long long start, long long length) {
  Epoch epoch;
  epoch.event = event;
  for (const auto& ch : channels) {
    eeg::pipeline::ChannelSeries series;
    series.label = ch.channel_label;
    series.sample_rate_hz = ch.sample_rate_hz;
    series.samples.assign(ch.samples.begin() + start, ch.samples.begin() + start + length);
    epoch.signal.channels.push_back(std::move(series));
  }
  return epoch;
}

}

std::vector<Epoch> cut_epochs(const std::vector<SignalWindow>& channels,
                              const std::vector<Event>& events, bool is_baseline) {
  std::vector<Epoch> epochs;
  if (channels.empty()) return epochs;

  const double fs = channels[0].sample_rate_hz;
  const long long n_samples = static_cast<long long>(channels[0].samples.size());
  const long long pre = std::llround(kEpochPreSec * fs);
  const long long length = std::llround((kEpochPreSec + kEpochPostSec) * fs);

  if (is_baseline) {
    for (long long start = 0; start + length <= n_samples; start += length) {
      epochs.push_back(make_epoch(channels, "T0", start, length));
    }
    return epochs;
  }

  for (const auto& ev : events) {
    if (ev.description != "T0" && ev.description != "T1" && ev.description != "T2") continue;

    const long long onset = std::llround(ev.onset_sec * fs);
    const long long start = onset - pre;
    if (start < 0 || start + length > n_samples) continue;

    epochs.push_back(make_epoch(channels, ev.description, start, length));
  }
  return epochs;
}

}
