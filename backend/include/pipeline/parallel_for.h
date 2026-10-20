#pragma once

#include <cstddef>
#include <functional>

namespace eeg::pipeline {

void set_max_threads(std::size_t n);

std::size_t get_max_threads();

void parallel_for(std::size_t count, const std::function<void(std::size_t)>& fn);

}
