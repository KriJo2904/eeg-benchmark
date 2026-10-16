#include "analysis/analysis.h"

#include <cmath>

namespace eeg::analysis {

namespace {

using json = nlohmann::json;

double round2(double x) { return std::round(x * 100.0) / 100.0; }

std::vector<double> rounded(const std::vector<double>& v) {
  std::vector<double> out;
  out.reserve(v.size());
  for (double x : v) out.push_back(round2(x));
  return out;
}

std::vector<std::string> split_key(const std::string& key) {
  std::vector<std::string> parts;
  std::size_t start = 0;
  while (true) {
    const std::size_t bar = key.find('|', start);
    parts.push_back(key.substr(start, bar - start));
    if (bar == std::string::npos) break;
    start = bar + 1;
  }
  return parts;
}

std::vector<std::vector<double>> erd_curves(const CurveSum& sum, const std::vector<double>& time) {
  std::vector<std::vector<double>> out;
  for (const auto& power : sum.power) {
    std::vector<double> mean(power.size());
    for (std::size_t t = 0; t < power.size(); ++t) mean[t] = power[t] / static_cast<double>(sum.epochs);
    out.push_back(erd_percent(mean, time));
  }
  return out;
}

json per_channel_json(const std::vector<std::string>& channels,
                      const std::vector<std::vector<double>>& curves) {
  json obj = json::object();
  for (std::size_t c = 0; c < channels.size() && c < curves.size(); ++c) {
    obj[channels[c]] = rounded(curves[c]);
  }
  return obj;
}

json tasks_json(const Selection& sel) {
  json tasks = json::array();
  for (const auto& id : sel.task_ids) {
    for (const auto& t : task_types()) {
      if (t.id != id) continue;
      json events = json::array();
      events.push_back({{"code", "T0"}, {"name", t.t1_name.empty() ? "spoczynek" : "odpoczynek"}});
      if (!t.t1_name.empty()) events.push_back({{"code", "T1"}, {"name", t.t1_name}});
      if (!t.t2_name.empty()) events.push_back({{"code", "T2"}, {"name", t.t2_name}});
      tasks.push_back({{"id", t.id}, {"name", t.name}, {"events", events}});
    }
  }
  return tasks;
}

json stats_json(const AnalysisResult& r) {
  json blocks = json::array();
  for (const auto& b : r.blocks) {
    if (b.kind == "start" || b.kind == "end") continue;
    blocks.push_back({{"kind", b.kind}, {"label", b.label}, {"ms", b.ms}});
  }
  return {{"recordsTotal", r.records_total}, {"recordsUsed", r.records_used},
          {"skipped", r.skipped},            {"epochs", r.epochs},
          {"threads", r.threads},            {"totalMs", r.total_ms},
          {"blocks", blocks}};
}

json maps_json(const AnalysisResult& r) {
  json maps = json::array();
  for (const auto& [key, map] : r.maps) {
    const auto parts = split_key(key);
    json data = json::object();
    for (std::size_t c = 0; c < map.power.size() && c < r.channels.size(); ++c) {
      json rows = json::array();
      const std::size_t n_rows = map.n_time ? map.power[c].size() / map.n_time : 0;
      for (std::size_t f = 0; f < n_rows; ++f) {
        std::vector<double> mean(map.n_time);
        for (std::size_t t = 0; t < map.n_time; ++t) {
          mean[t] = map.power[c][f * map.n_time + t] / static_cast<double>(map.epochs);
        }
        rows.push_back(rounded(erd_percent(mean, r.time_sec)));
      }
      data[r.channels[c]] = rows;
    }
    maps.push_back({{"task", parts[0]}, {"event", parts[1]}, {"epochs", map.epochs}, {"data", data}});
  }
  return maps;
}

}

json to_documents(const AnalysisResult& r, const Selection& sel) {
  json subject_data = json::object();

  std::map<std::string, std::vector<std::vector<double>>> grand_sum;
  std::map<std::string, int> grand_subjects;
  std::map<std::string, std::size_t> grand_epochs;

  for (const auto& [key, curve] : r.curves) {
    const auto parts = split_key(key);
    const auto erd = erd_curves(curve, r.time_sec);
    subject_data[parts[0]][parts[1]][parts[2]] = {{"erd", per_channel_json(r.channels, erd)},
                                                  {"epochs", curve.epochs}};

    const std::string group = parts[1] + "|" + parts[2];
    auto& sum = grand_sum[group];
    if (sum.empty()) sum.resize(erd.size());
    for (std::size_t c = 0; c < erd.size(); ++c) {
      if (sum[c].empty()) sum[c].assign(erd[c].size(), 0.0);
      for (std::size_t t = 0; t < erd[c].size() && t < sum[c].size(); ++t) sum[c][t] += erd[c][t];
    }
    grand_subjects[group] += 1;
    grand_epochs[group] += curve.epochs;
  }

  json average = json::object();
  for (auto& [group, sum] : grand_sum) {
    const auto parts = split_key(group);
    for (auto& curve : sum) {
      for (double& x : curve) x /= static_cast<double>(grand_subjects[group]);
    }
    average[parts[0]][parts[1]] = {{"erd", per_channel_json(r.channels, sum)},
                                   {"subjects", grand_subjects[group]},
                                   {"epochs", grand_epochs[group]}};
  }

  json subject_ids = json::array();
  json subjects = json::array();
  for (const auto& [id, data] : subject_data.items()) {
    subject_ids.push_back(id);
    subjects.push_back({{"subjectId", id}, {"data", data}});
  }

  json summary = {{"channels", r.channels},
                  {"time", rounded(r.time_sec)},
                  {"freq", r.freq_hz},
                  {"band", {{"fMin", r.band_f_min}, {"fMax", r.band_f_max}}},
                  {"tasks", tasks_json(sel)},
                  {"subjects", subject_ids},
                  {"average", average},
                  {"stats", stats_json(r)}};

  return {{"summary", summary}, {"subjects", subjects}, {"maps", maps_json(r)}};
}

}
