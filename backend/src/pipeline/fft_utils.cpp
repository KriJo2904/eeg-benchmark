#include "pipeline/fft_utils.h"

#include "pocketfft_hdronly.h"

#include <cmath>
#include <cstddef>

namespace eeg::pipeline {

struct RealFft::Plan {
  explicit Plan(std::size_t n) : fft(n) {}
  pocketfft::detail::pocketfft_r<double> fft;
};

RealFft::RealFft(std::size_t window_size)
    : n_(window_size), plan_(std::make_unique<Plan>(window_size)) {}

RealFft::~RealFft() = default;

void RealFft::power(std::vector<double>& data, std::vector<double>& power_out) const {
  power_out.resize(n_ / 2 + 1);
  if (data.size() != n_ || n_ == 0) return;

  plan_->fft.exec(data.data(), 1.0,true);

  power_out[0] = data[0] * data[0];
  for (std::size_t k = 1; k < power_out.size(); ++k) {
    const double re = data[2 * k - 1];
    const double im = (2 * k < n_) ? data[2 * k] : 0.0;
    power_out[k] = re * re + im * im;
  }
}

std::vector<double> hann_window(std::size_t n) {
  std::vector<double> w(n);
  if (n == 0) return w;
  if (n == 1) {
    w[0] = 1.0;
    return w;
  }
  for (std::size_t i = 0; i < n; ++i) {
    w[i] = 0.5 - 0.5 * std::cos(2.0 * M_PI * static_cast<double>(i) / static_cast<double>(n - 1));
  }
  return w;
}

}
