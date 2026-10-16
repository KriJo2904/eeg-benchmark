#include "pipeline/block.h"

#include <algorithm>
#include <cmath>
#include <string>

namespace eeg::pipeline {

namespace {

void zscore_inplace(std::vector<double>& v) {
  const std::size_t n = v.size();
  if (n == 0) return;

  double mean = 0.0;
  for (double x : v) mean += x;
  mean /= static_cast<double>(n);

  double var = 0.0;
  for (double x : v) var += (x - mean) * (x - mean);
  var /= static_cast<double>(n);
  const double sd = std::sqrt(var) > 0.0 ? std::sqrt(var) : 1.0;

  for (double& x : v) x = (x - mean) / sd;
}

void minmax_inplace(std::vector<double>& v) {
  if (v.empty()) return;
  double mn = v[0], mx = v[0];
  for (double x : v) {
    mn = std::min(mn, x);
    mx = std::max(mx, x);
  }
  const double range = (mx - mn) > 0.0 ? (mx - mn) : 1.0;
  for (double& x : v) x = (x - mn) / range;
}

}

class NormalizeBlock final : public Block {
 public:

  void process(const nlohmann::json& params, Signal& out) override {
    const std::string method = params.value("method", std::string("zscore"));

    for (auto& ch : out.channels) {
      if (method == "minmax") {
        minmax_inplace(ch.samples);
      } else {
        zscore_inplace(ch.samples);
      }
    }
  }
};

EEG_REGISTER_BLOCK("normalize", NormalizeBlock)

}
