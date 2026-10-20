#include "analysis/analysis.h"
#include "analysis/benchmark.h"
#include "analysis/selection.h"
#include "dataset_index.h"
#include "edf_reader.h"
#include "pipeline/pipeline.h"

#include <nlohmann/json.hpp>

#include <cstdio>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace {

using json = nlohmann::json;
using eeg::analysis::Selection;

std::vector<std::string> split_csv(const std::string& s) {
  std::vector<std::string> out;
  std::istringstream ss(s);
  for (std::string tok; std::getline(ss, tok, ',');) {
    if (!tok.empty()) out.push_back(tok);
  }
  return out;
}

json default_pipeline() {
  json nodes = json::array();
  nodes.push_back({{"id", "start"}, {"data", {{"kind", "start"}, {"label", "Start"}}}});
  nodes.push_back({{"id", "n1"}, {"data", {{"kind", "fft"}, {"label", "FFT"},
                                            {"params", {{"windowSize", 128}, {"overlap", 0.9}}}}}});
  nodes.push_back({{"id", "n2"}, {"data", {{"kind", "spektrogram"}, {"label", "Spektrogram"},
                                            {"params", {{"fMin", 4}, {"fMax", 40}}}}}});
  nodes.push_back({{"id", "n3"}, {"data", {{"kind", "band_power"}, {"label", "Moc pasma"},
                                            {"params", {{"fMin", 8}, {"fMax", 13}, {"agg", "mean"}}}}}});
  nodes.push_back({{"id", "end"}, {"data", {{"kind", "end"}, {"label", "Koniec"}}}});

  json edges = json::array();
  const std::vector<std::string> order = {"start", "n1", "n2", "n3", "end"};
  for (std::size_t i = 1; i < order.size(); ++i) {
    edges.push_back({{"source", order[i - 1]}, {"target", order[i]}});
  }
  return {{"version", 1}, {"nodes", nodes}, {"edges", edges}};
}

void parse_subjects(const std::string& arg, const std::vector<std::string>& all, Selection& sel) {
  if (arg == "all") {
    sel.all_subjects = true;
    return;
  }
  sel.all_subjects = false;
  const std::size_t dash = arg.find('-');
  if (dash != std::string::npos) {
    const std::string from = arg.substr(0, dash), to = arg.substr(dash + 1);
    for (const auto& s : all) {
      if (s >= from && s <= to) sel.subjects.push_back(s);
    }
    return;
  }
  sel.subjects = split_csv(arg);
}

std::vector<std::string> parse_channels(const std::string& arg, const eeg::EdfReader& reader,
                                        const std::filesystem::path& any_record) {
  if (arg == "motor") {
    return {"Fc5", "Fc3", "Fc1", "Fcz", "Fc2", "Fc4", "Fc6", "C5",  "C3",  "C1",  "Cz",
            "C2",  "C4",  "C6",  "Cp5", "Cp3", "Cp1", "Cpz", "Cp2", "Cp4", "Cp6"};
  }
  if (arg == "all") {
    std::vector<std::string> labels;
    const auto meta = reader.read_metadata(any_record, any_record.filename().string());
    for (const auto& ch : meta.channels) {
      std::string label = ch.label;
      while (!label.empty() && label.back() == '.') label.pop_back();
      labels.push_back(label);
    }
    return labels;
  }
  return split_csv(arg);
}

void print_erd_check(const json& summary, const std::string& task) {
  const auto& time = summary["time"];
  const auto& by_event = summary["average"][task];
  std::cout << "\nSrednie ERD % w 0,5-2,5 s po zdarzeniu (ujemne = spadek mocy = ERD):\n";
  for (const auto& [event, value] : by_event.items()) {
    std::cout << "  " << event << ":";
    for (const auto& [channel, erd] : value["erd"].items()) {
      double sum = 0.0;
      int n = 0;
      for (std::size_t i = 0; i < erd.size() && i < time.size(); ++i) {
        const double t = time[i].get<double>();
        if (t >= 0.5 && t <= 2.5) {
          sum += erd[i].get<double>();
          ++n;
        }
      }
      std::printf(" %s=%+.0f%%", channel.c_str(), n ? sum / n : 0.0);
    }
    std::cout << "\n";
  }
}

void write_erd_csv(const json& summary, const std::string& task) {
  std::ofstream csv("erd_srednia.csv");
  csv << "zadanie,zdarzenie,elektroda,czas_s,erd_proc\n";
  const auto& time = summary["time"];
  for (const auto& [event, value] : summary["average"][task].items()) {
    for (const auto& [channel, erd] : value["erd"].items()) {
      for (std::size_t i = 0; i < erd.size() && i < time.size(); ++i) {
        csv << task << "," << event << "," << channel << "," << time[i] << "," << erd[i] << "\n";
      }
    }
  }
}

}

int main(int argc, char** argv) {
  if (argc < 5) {
    std::cerr << "Uzycie: bench_analysis <katalog_eegmmidb> <badani> <zadanie> <elektrody> "
                 "[powtorzenia=3]\n"
                 "  badani: all | S001-S010 | S001,S005   zadanie: wyobrazenie_lp ...   "
                 "elektrody: motor | all | C3,C4,Cz\n";
    return 2;
  }
  const int repeats = (argc >= 6) ? std::stoi(argv[5]) : 3;

  try {
    eeg::DatasetIndex index(argv[1]);
    index.scan();
    const auto all_subjects = index.list_subjects();
    if (all_subjects.empty()) throw std::runtime_error("brak plików .edf w katalogu " + std::string(argv[1]));

    eeg::EdfReader reader;
    Selection sel;
    parse_subjects(argv[2], all_subjects, sel);
    sel.task_ids = {argv[3]};
    sel.channels = parse_channels(argv[4], reader, index.resolve_path(index.list_records().front().id));

    const auto graph = eeg::pipeline::parse_pipeline(default_pipeline());
    const auto jobs = eeg::analysis::resolve_records(sel, index);
    std::cout << "rekordy: " << jobs.size() << ", elektrody: " << sel.channels.size()
              << ", zadanie: " << argv[3] << ", pipeline: FFT(128, 90%) -> moc pasma 8-13 Hz\n";

    const auto bench = eeg::analysis::run_benchmark(graph, jobs, sel.channels, reader, repeats);
    std::cout << "uzyte rekordy: " << bench.records_used << ", epoki: " << bench.epochs
              << ", rdzenie: " << bench.hardware_concurrency << ", mediana z " << bench.repeats << "\n";

    std::ofstream csv("bench_analysis.csv");
    csv << "threads,median_ms,speedup,efficiency\n";
    const double baseline_ms = bench.runs.front().ms;
    for (const auto& run : bench.runs) {
      const double speedup = baseline_ms / run.ms;
      const double efficiency = speedup / static_cast<double>(run.threads);
      std::printf("watki: %2zu  czas: %9.1f ms  speedup: %5.2fx  efektywnosc: %.2f\n", run.threads,
                  run.ms, speedup, efficiency);
      csv << run.threads << "," << run.ms << "," << speedup << "," << efficiency << "\n";
    }
    std::cout << "zapisano bench_analysis.csv\n";

    const auto result = eeg::analysis::run_analysis(graph, jobs, sel.channels, reader);
    const json summary = eeg::analysis::to_documents(result, sel)["summary"];
    std::cout << "\nczas blokow pipeline'u (suma po epokach i watkach, " << result.threads << " watkow):";
    for (const auto& b : result.blocks) {
      if (b.kind != "start" && b.kind != "end") std::printf(" %s=%.0f ms", b.kind.c_str(), b.ms);
    }
    std::printf("  |  cala analiza: %.0f ms\n", result.total_ms);
    print_erd_check(summary, argv[3]);
    write_erd_csv(summary, argv[3]);
    std::cout << "zapisano erd_srednia.csv\n";
  } catch (const std::exception& e) {
    std::cerr << "error: " << e.what() << "\n";
    return 1;
  }
  return 0;
}
