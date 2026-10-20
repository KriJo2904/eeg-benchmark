#pragma once

#include "pipeline/block.h"

#include <nlohmann/json.hpp>

#include <string>
#include <vector>

namespace eeg::pipeline {

struct GraphNode {
  std::string id;
  std::string kind;
  std::string label;
  nlohmann::json params = nlohmann::json::object();
};

struct GraphEdge {
  std::string source;
  std::string target;
};

struct PipelineGraph {
  std::vector<GraphNode> nodes;
  std::vector<GraphEdge> edges;
};

PipelineGraph parse_pipeline(const nlohmann::json& j);

std::vector<std::string> execution_order(const PipelineGraph& g);

struct NodeRunResult {
  std::string node_id;
  std::string kind;
  std::string label;
  std::string status;
  double duration_ms = 0;
};

struct PipelineRunResult {
  std::vector<NodeRunResult> nodes;
  double total_ms = 0;
  Signal output;
};

PipelineRunResult run_pipeline(const PipelineGraph& g, Signal sig);

}
