#include "pipeline/block.h"
#include "pipeline/stft.h"

#include <algorithm>

namespace eeg::pipeline {

class FftBlock final : public Block {
 public:

  void process(const BlockContext& ctx, Signal& out) override {
    const int window_size = std::max(2, ctx.params.value("windowSize", 512));
    const double overlap = ctx.params.value("overlap", 0.5);

    out.spectrograms = compute_stft_all(out.channels, window_size, overlap);
  }
};

EEG_REGISTER_BLOCK("fft", "processing", "Transformacja Fouriera", FftBlock)

}
