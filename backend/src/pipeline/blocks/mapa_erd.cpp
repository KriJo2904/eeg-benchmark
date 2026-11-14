#include "pipeline/block.h"
#include "pipeline/stft.h"

namespace eeg::pipeline {

class MapaErdBlock final : public Block {
 public:
  void process(const nlohmann::json& params, Signal& out) override {
    const double f_min = params.value("fMin", 4.0);
    const double f_max = params.value("fMax", 40.0);

    out.map_freq_hz.clear();
    out.map_power.clear();
    if (out.spectrograms.empty()) return;

    const auto rows = rows_in_range(out.spectrograms[0].freq_hz, f_min, f_max);
    for (std::size_t f : rows) out.map_freq_hz.push_back(out.spectrograms[0].freq_hz[f]);

    for (const auto& spec : out.spectrograms) {
      const std::size_t n_time = spec.time_sec.size();
      std::vector<double> power(rows.size() * n_time, 0.0);
      for (std::size_t r = 0; r < rows.size(); ++r) {
        for (std::size_t t = 0; t < n_time; ++t) power[r * n_time + t] = spec.power_at(rows[r], t);
      }
      out.map_power.push_back(power);
    }
  }
};

EEG_REGISTER_BLOCK("mapa_erd", MapaErdBlock)

}
