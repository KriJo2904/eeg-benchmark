#include "pipeline/block.h"
#include "pipeline/stft.h"

#include <algorithm>

namespace eeg::pipeline {

class FftBlock final : public Block {
 public:

  void process(const nlohmann::json& params, Signal& out) override {
    const int window_size = std::max(2, params.value("windowSize", 128));
    const double overlap = params.value("overlap", 0.9);

    out.spectrograms = compute_stft_all(out.channels, window_size, overlap, 1);
  }
};

EEG_REGISTER_BLOCK("fft", FftBlock)

}
