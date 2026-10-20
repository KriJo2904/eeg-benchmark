#include "pipeline/block.h"

namespace eeg::pipeline {

class SpektrogramBlock final : public Block {
 public:
  void process(const BlockContext& ctx, Signal& out) override {
    out.map_f_min = ctx.params.value("fMin", 4.0);
    out.map_f_max = ctx.params.value("fMax", 40.0);
  }
};

EEG_REGISTER_BLOCK("spektrogram", "analysis", "Spektrogram", SpektrogramBlock)

}
