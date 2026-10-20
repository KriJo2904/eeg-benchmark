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

  std::vector<std::vector<double>> band_power;

  double map_f_min = 0.0;
  double map_f_max = 0.0;
};

struct BlockContext {
  std::string node_id;
  std::string label;
  nlohmann::json params = nlohmann::json::object();
};

class Block {
 public:
  virtual ~Block() = default;
  virtual void process(const BlockContext& ctx, Signal& sig) = 0;
};

using BlockFactory = std::function<std::unique_ptr<Block>()>;

struct BlockDescriptor {
  std::string kind;
  std::string category;
  std::string title;
  BlockFactory factory;
};

class BlockRegistry {
 public:
  static BlockRegistry& instance();

  void register_block(BlockDescriptor desc);
  std::unique_ptr<Block> create(const std::string& kind) const;
  std::vector<BlockDescriptor> all() const;

 private:
  const BlockDescriptor* find(const std::string& kind) const;
  std::vector<BlockDescriptor> blocks_;
};

struct BlockRegistrar {
  explicit BlockRegistrar(BlockDescriptor desc) {
    BlockRegistry::instance().register_block(std::move(desc));
  }
};

#define EEG_REGISTER_BLOCK(kind, category, title, BlockClass)                     \
  namespace {                                                                     \
  const ::eeg::pipeline::BlockRegistrar eeg_block_registrar_##BlockClass{         \
      {(kind),                                                                    \
       (category),                                                                \
       (title),                                                                   \
       []() -> std::unique_ptr<::eeg::pipeline::Block> {                         \
         return std::make_unique<BlockClass>();                                   \
       }}};                                                                       \
  }

}
