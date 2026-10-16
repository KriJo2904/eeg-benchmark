#pragma once

#include <cstddef>
#include <memory>
#include <vector>

namespace eeg::pipeline {

class RealFft {
 public:
  explicit RealFft(std::size_t window_size);
  ~RealFft();

  void power(std::vector<double>& data, std::vector<double>& power_out) const;

  std::size_t size() const { return n_; }

 private:
  struct Plan;
  std::size_t n_;
  std::unique_ptr<Plan> plan_;
};

std::vector<double> hann_window(std::size_t n);

}
