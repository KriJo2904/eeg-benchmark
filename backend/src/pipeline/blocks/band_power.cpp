#include "pipeline/block.h"

#include <string>
#include <vector>

namespace eeg::pipeline {

namespace {

std::vector<double> band_power_series(const ChannelSpectrogram& spec, double f_min, double f_max,
                                      const std::string& agg) {
  std::vector<std::size_t> indices;
  for (std::size_t i = 0; i < spec.freq_hz.size(); ++i) {
    if (spec.freq_hz[i] >= f_min && spec.freq_hz[i] <= f_max) indices.push_back(i);
  }

  const std::size_t n_frames = spec.time_sec.size();
  std::vector<double> moc(n_frames, 0.0);
  if (indices.empty()) return moc;

  for (std::size_t t = 0; t < n_frames; ++t) {
    double sum = 0.0;
    for (std::size_t idx : indices) sum += spec.power_at(idx, t);
    moc[t] = (agg == "sum") ? sum : (sum / static_cast<double>(indices.size()));
  }
  return moc;
}

}

class BandPowerBlock final : public Block {
 public:

  void process(const BlockContext& ctx, Signal& out) override {
    const double f_min = ctx.params.value("fMin", 8.0);
    const double f_max = ctx.params.value("fMax", 13.0);
    const std::string agg = ctx.params.value("agg", std::string("mean"));

    out.band_power.clear();
    for (const auto& spec : out.spectrograms) {
      out.band_power.push_back(band_power_series(spec, f_min, f_max, agg));
    }
  }
};

EEG_REGISTER_BLOCK("band_power", "analysis", "Moc pasma w czasie", BandPowerBlock)

}
