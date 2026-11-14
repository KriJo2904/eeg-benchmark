#include "pipeline/block.h"
#include "pipeline/stft.h"

namespace eeg::pipeline {

class KrzywaErdBlock final : public Block {
 public:
  void process(const nlohmann::json& params, Signal& out) override {
    const double f_min = params.value("fMin", 8.0);
    const double f_max = params.value("fMax", 13.0);

    out.band_power.clear();
    for (const auto& spec : out.spectrograms) {
      const auto rows = rows_in_range(spec.freq_hz, f_min, f_max);
      std::vector<double> power(spec.time_sec.size(), 0.0);
      for (std::size_t t = 0; t < power.size() && !rows.empty(); ++t) {
        double sum = 0.0;
        for (std::size_t f : rows) sum += spec.power_at(f, t);
        power[t] = sum / static_cast<double>(rows.size());
      }
      out.band_power.push_back(power);
    }
  }
};

EEG_REGISTER_BLOCK("krzywa_erd", KrzywaErdBlock)

}
