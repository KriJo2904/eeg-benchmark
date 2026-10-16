#include "pipeline/block.h"

#include <algorithm>

namespace eeg::pipeline {

BlockRegistry& BlockRegistry::instance() {
  static BlockRegistry reg;
  return reg;
}

void BlockRegistry::register_block(BlockDescriptor desc) {
  auto it = std::find_if(blocks_.begin(), blocks_.end(),
                         [&](const BlockDescriptor& d) { return d.kind == desc.kind; });
  if (it != blocks_.end())
    *it = std::move(desc);
  else
    blocks_.push_back(std::move(desc));
}

const BlockDescriptor* BlockRegistry::find(const std::string& kind) const {
  auto it = std::find_if(blocks_.begin(), blocks_.end(),
                         [&](const BlockDescriptor& d) { return d.kind == kind; });
  return it == blocks_.end() ? nullptr : &*it;
}

std::unique_ptr<Block> BlockRegistry::create(const std::string& kind) const {
  const BlockDescriptor* d = find(kind);
  return d ? d->factory() : nullptr;
}

}
