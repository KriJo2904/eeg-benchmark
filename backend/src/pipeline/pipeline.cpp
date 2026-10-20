#include "pipeline/pipeline.h"

#include <algorithm>
#include <chrono>
#include <stdexcept>
#include <unordered_map>
#include <unordered_set>

namespace eeg::pipeline {

namespace {
constexpr const char* kStartId = "start";
bool is_structural(const std::string& kind) { return kind == "start" || kind == "end"; }
}

PipelineGraph parse_pipeline(const nlohmann::json& j) {
  if (!j.is_object()) throw std::runtime_error("pipeline: expected object");
  if (!j.contains("nodes") || !j["nodes"].is_array())
    throw std::runtime_error("pipeline: missing 'nodes' array");
  if (!j.contains("edges") || !j["edges"].is_array())
    throw std::runtime_error("pipeline: missing 'edges' array");

  PipelineGraph g;
  for (const auto& n : j["nodes"]) {
    const auto& data = n.value("data", nlohmann::json::object());
    GraphNode node;
    node.id = n.value("id", std::string{});
    node.kind = data.value("kind", std::string{});
    node.label = data.value("label", std::string{});
    node.params = data.value("params", nlohmann::json::object());
    if (node.id.empty() || node.kind.empty()) continue;
    g.nodes.push_back(std::move(node));
  }
  for (const auto& e : j["edges"]) {
    GraphEdge edge;
    edge.source = e.value("source", std::string{});
    edge.target = e.value("target", std::string{});
    if (edge.source.empty() || edge.target.empty()) continue;
    g.edges.push_back(std::move(edge));
  }
  return g;
}

std::vector<std::string> execution_order(const PipelineGraph& g) {
  std::unordered_set<std::string> node_ids;
  for (const auto& n : g.nodes) node_ids.insert(n.id);
  if (!node_ids.count(kStartId)) return {};

  std::vector<std::string> order{kStartId};
  std::unordered_set<std::string> visited{kStartId};
  std::string current = kStartId;
  while (true) {
    std::string next;
    for (const auto& e : g.edges) {
      if (e.source == current && node_ids.count(e.target)) {
        next = e.target;
        break;
      }
    }
    if (next.empty() || visited.count(next)) break;
    order.push_back(next);
    visited.insert(next);
    current = next;
  }
  return order;
}

PipelineRunResult run_pipeline(const PipelineGraph& g, Signal sig) {
  using clock = std::chrono::steady_clock;
  auto ms_since = [](clock::time_point t) {
    return std::chrono::duration<double, std::milli>(clock::now() - t).count();
  };

  std::unordered_map<std::string, const GraphNode*> by_id;
  for (const auto& n : g.nodes) by_id[n.id] = &n;

  const BlockRegistry& reg = BlockRegistry::instance();

  PipelineRunResult result;

  auto pipeline_start = clock::now();
  for (const auto& id : execution_order(g)) {
    auto it = by_id.find(id);
    if (it == by_id.end()) continue;
    const GraphNode& node = *it->second;

    NodeRunResult nr;
    nr.node_id = node.id;
    nr.kind = node.kind;
    nr.label = node.label;

    auto node_start = clock::now();

    if (is_structural(node.kind)) {
      nr.status = "skipped";
    } else if (auto block = reg.create(node.kind)) {
      BlockContext ctx{node.id, node.label, node.params};
      block->process(ctx, sig);
      nr.status = "ok";
    } else {
      nr.status = "unknown-kind";
    }

    nr.duration_ms = ms_since(node_start);
    result.nodes.push_back(std::move(nr));
  }

  result.total_ms = ms_since(pipeline_start);
  result.output = std::move(sig);
  return result;
}

}
