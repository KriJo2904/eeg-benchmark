#pragma once

#include <cstddef>
#include <functional>

namespace eeg::pipeline {

std::size_t default_threads();

std::size_t range_begin(std::size_t count, std::size_t n_parts, std::size_t part);

void parallel_for(std::size_t count, std::size_t n_threads,
                  const std::function<void(std::size_t)>& fn);

}
