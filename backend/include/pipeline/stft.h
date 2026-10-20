#pragma once

#include "pipeline/block.h"

#include <vector>

namespace eeg::pipeline {

std::vector<ChannelSpectrogram> compute_stft_all(const std::vector<ChannelSeries>& channels,
                                                 int window_size, double overlap);

}
