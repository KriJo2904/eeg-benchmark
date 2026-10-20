#include "pipeline/block.h"

#include <algorithm>
#include <cmath>

namespace eeg::pipeline {

namespace {

std::vector<double> moving_average(const std::vector<double>& src, int window) {
  const int n = static_cast<int>(src.size());
  std::vector<double> out(src.size());
  const int half = std::max(1, window / 2);
  for (int i = 0; i < n; ++i) {
    const int lo = std::max(0, i - half);
    const int hi = std::min(n - 1, i + half);
    double sum = 0.0;
    for (int j = lo; j <= hi; ++j) sum += src[j];
    out[i] = sum / static_cast<double>(hi - lo + 1);
  }
  return out;
}

}

class LowpassBlock final : public Block {
 public:

  void process(const BlockContext& ctx, Signal& out) override {
    const double cutoff_hz = ctx.params.value("cutoffHz", 30.0);
    const int order = std::max(1, ctx.params.value("order", 1));

    for (auto& ch : out.channels) {
      if (ch.sample_rate_hz <= 0.0 || cutoff_hz <= 0.0) continue;
      int window = static_cast<int>(std::round(ch.sample_rate_hz / cutoff_hz));
      window = std::max(1, window);
      for (int pass = 0; pass < order; ++pass) {
        ch.samples = moving_average(ch.samples, window);
      }
    }
  }
};

EEG_REGISTER_BLOCK("lowpass", "processing", "Filtr dolnoprzepustowy", LowpassBlock)

}
