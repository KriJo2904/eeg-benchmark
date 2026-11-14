#pragma once

#include "pipeline/block.h"

#include <vector>

namespace eeg::pipeline {

std::vector<ChannelSpectrogram> compute_stft_all(const std::vector<ChannelSeries>& channels,
                                                 int window_size, double overlap,
                                                 std::size_t threads);

std::vector<std::size_t> rows_in_range(const std::vector<double>& freq, double f_min, double f_max);

}
