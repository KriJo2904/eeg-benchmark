#include "pipeline/pipeline.h"

#include <algorithm>
#include <chrono>
#include <stdexcept>
#include <unordered_map>
#include <unordered_set>

namespace eeg::pipeline {

namespace {
constexpr const char* kStartId = "start";

bool is_result(const std::string& kind) { return kind == "krzywa_erd" || kind == "mapa_erd"; }

bool is_skipped(const std::string& kind) { return kind == "start" || kind == "end"; }

const GraphNode* find_node(const PipelineGraph& g, const std::string& id) {
  for (const auto& n : g.nodes) {
    if (n.id == id) return &n;
  }
  return nullptr;
}

std::vector<std::string> chain_from_start(const PipelineGraph& g) {
  if (!find_node(g, kStartId)) return {};

  std::vector<std::string> order{kStartId};
  std::unordered_set<std::string> visited{kStartId};
  std::string current = kStartId;
  while (find_node(g, current)->kind != "stft") {
    std::string next;
    for (const auto& e : g.edges) {
      const GraphNode* target = find_node(g, e.target);
      if (e.source == current && target && !is_result(target->kind)) {
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

void read_range(const nlohmann::json& from, nlohmann::json& into) {
  if (!from.is_object()) return;
  if (from.contains("fMin")) into["fMin"] = from["fMin"];
  if (from.contains("fMax")) into["fMax"] = from["fMax"];
}

bool is_legacy(const PipelineGraph& g) {
  for (const auto& n : g.nodes) {
    if (n.kind == "stft" || is_result(n.kind)) return false;
  }
  return true;
}

PipelineGraph upgrade_legacy(const PipelineGraph& old, const nlohmann::json& j) {
  nlohmann::json band = {{"fMin", 8.0}, {"fMax", 13.0}};
  nlohmann::json map = {{"fMin", 4.0}, {"fMax", 40.0}};
  for (const auto& n : old.nodes) {
    if (n.kind == "band_power") read_range(n.params, band);
    if (n.kind == "spektrogram") read_range(n.params, map);
  }
  const auto analysis = j.value("analysis", nlohmann::json::object());
  read_range(analysis.value("band", nlohmann::json::object()), band);
  read_range(analysis.value("map", nlohmann::json::object()), map);

  PipelineGraph g;
  g.nodes.push_back({kStartId, "start", "Start", nlohmann::json::object()});
  std::string prev = kStartId;
  std::string stft_id;
  for (const auto& id : chain_from_start(old)) {
    const GraphNode* n = find_node(old, id);
    if (n->kind != "lowpass" && n->kind != "normalize" && n->kind != "fft") continue;
    GraphNode node = *n;
    if (node.kind == "fft") node.kind = "stft";
    g.nodes.push_back(node);
    g.edges.push_back({prev, node.id});
    prev = node.id;
    if (node.kind == "stft") {
      stft_id = node.id;
      break;
    }
  }
  if (!stft_id.empty()) {
    g.nodes.push_back({"erd", "krzywa_erd", "Krzywa ERD", band});
    g.nodes.push_back({"mapa", "mapa_erd", "Mapa ERD", map});
    g.edges.push_back({stft_id, "erd"});
    g.edges.push_back({stft_id, "mapa"});
  }
  return g;
}
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
  return is_legacy(g) ? upgrade_legacy(g, j) : g;
}

std::vector<std::string> execution_order(const PipelineGraph& g) {
  std::vector<std::string> order = chain_from_start(g);
  if (order.empty() || find_node(g, order.back())->kind != "stft") return order;

  const std::string stft_id = order.back();
  std::unordered_set<std::string> added;
  for (const auto& e : g.edges) {
    const GraphNode* target = find_node(g, e.target);
    if (e.source == stft_id && target && is_result(target->kind) && !added.count(e.target)) {
      order.push_back(e.target);
      added.insert(e.target);
    }
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

  for (const auto& id : execution_order(g)) {
    auto it = by_id.find(id);
    if (it == by_id.end()) continue;
    const GraphNode& node = *it->second;

    NodeRunResult nr;
    nr.kind = node.kind;
    nr.label = node.label;

    auto node_start = clock::now();

    if (!is_skipped(node.kind)) {
      std::unique_ptr<Block> block = reg.create(node.kind);
      if (!block) throw std::runtime_error("Nieznany typ bloku: " + node.kind);
      block->process(node.params, sig);
    }

    nr.duration_ms = ms_since(node_start);
    result.nodes.push_back(std::move(nr));
  }

  result.output = std::move(sig);
  return result;
}

}
