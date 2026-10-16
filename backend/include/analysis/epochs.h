#pragma once

#include "edf_reader.h"
#include "pipeline/block.h"

#include <string>
#include <vector>

namespace eeg::analysis {

constexpr double kEpochPreSec = 1.0;
constexpr double kEpochPostSec = 4.0;

struct Epoch {
  std::string event;
  eeg::pipeline::Signal signal;
};

std::vector<Epoch> cut_epochs(const std::vector<SignalWindow>& channels,
                              const std::vector<Event>& events, bool is_baseline);

}
