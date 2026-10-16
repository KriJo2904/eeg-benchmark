#pragma once

#include <nlohmann/json.hpp>

#include <functional>
#include <memory>
#include <string>
#include <vector>

namespace eeg::pipeline {

struct ChannelSeries {
  std::string label;
  double sample_rate_hz = 0.0;
  std::vector<double> samples;
};

struct ChannelSpectrogram {
  std::string label;
  std::vector<double> freq_hz;
  std::vector<double> time_sec;
  std::vector<double> power;

  double power_at(std::size_t f, std::size_t t) const { return power[f * time_sec.size() + t]; }
  double& power_at(std::size_t f, std::size_t t) { return power[f * time_sec.size() + t]; }
};

struct Signal {
  std::vector<ChannelSeries> channels;
  std::vector<ChannelSpectrogram> spectrograms;
};

class Block {
 public:
  virtual ~Block() = default;
  virtual void process(const nlohmann::json& params, Signal& sig) = 0;
};

using BlockFactory = std::function<std::unique_ptr<Block>()>;

struct BlockDescriptor {
  std::string kind;
  BlockFactory factory;
};

class BlockRegistry {
 public:
  static BlockRegistry& instance();

  void register_block(BlockDescriptor desc);
  std::unique_ptr<Block> create(const std::string& kind) const;

 private:
  const BlockDescriptor* find(const std::string& kind) const;
  std::vector<BlockDescriptor> blocks_;
};

struct BlockRegistrar {
  explicit BlockRegistrar(BlockDescriptor desc) {
    BlockRegistry::instance().register_block(std::move(desc));
  }
};

#define EEG_REGISTER_BLOCK(kind, BlockClass)                                      \
  namespace {                                                                     \
  const ::eeg::pipeline::BlockRegistrar eeg_block_registrar_##BlockClass{         \
      {(kind),                                                                    \
       []() -> std::unique_ptr<::eeg::pipeline::Block> {                         \
         return std::make_unique<BlockClass>();                                   \
       }}};                                                                       \
  }

}
