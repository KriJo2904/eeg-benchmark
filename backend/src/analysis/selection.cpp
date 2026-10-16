#include "analysis/selection.h"

#include <algorithm>
#include <cstdio>
#include <filesystem>
#include <stdexcept>

namespace eeg::analysis {

const std::vector<TaskType>& task_types() {
  static const std::vector<TaskType> types = {
      {"baseline", "Spoczynek (baseline)", {1, 2}, "", ""},
      {"ruch_lp", "Ruch: lewa / prawa pięść", {3, 7, 11}, "lewa pięść", "prawa pięść"},
      {"wyobrazenie_lp", "Wyobrażenie: lewa / prawa pięść", {4, 8, 12}, "lewa pięść", "prawa pięść"},
      {"ruch_ps", "Ruch: obie pięści / stopy", {5, 9, 13}, "obie pięści", "obie stopy"},
      {"wyobrazenie_ps", "Wyobrażenie: obie pięści / stopy", {6, 10, 14}, "obie pięści", "obie stopy"},
  };
  return types;
}

namespace {

std::size_t find_task(const std::string& id) {
  const auto& types = task_types();
  for (std::size_t i = 0; i < types.size(); ++i) {
    if (types[i].id == id) return i;
  }
  throw std::runtime_error("Nieznany typ zadania: " + id);
}

std::vector<std::string> json_strings(const nlohmann::json& j, const char* key) {
  std::vector<std::string> out;
  if (!j.contains(key) || !j[key].is_array()) return out;
  for (const auto& x : j[key]) {
    if (x.is_string()) out.push_back(x.get<std::string>());
  }
  return out;
}

std::string record_id_for(const std::string& subject, int run) {
  char name[32];
  std::snprintf(name, sizeof(name), "%sR%02d.edf", subject.c_str(), run);
  return subject + "/" + name;
}

}

Selection parse_selection(const nlohmann::json& ds) {
  if (!ds.is_object() || ds.value("version", 1) < 2) {
    throw std::runtime_error("Projekt nie ma zapisanej selekcji (badani / zadania / elektrody). "
                             "Uzupełnij zakładkę Selekcja.");
  }

  Selection sel;
  sel.all_subjects = ds.contains("subjects") && ds["subjects"].is_string() && ds["subjects"] == "all";
  if (!sel.all_subjects) sel.subjects = json_strings(ds, "subjects");
  sel.task_ids = json_strings(ds, "tasks");
  sel.channels = json_strings(ds, "channels");

  if (!sel.all_subjects && sel.subjects.empty()) throw std::runtime_error("Nie wybrano żadnego badanego.");
  if (sel.task_ids.empty()) throw std::runtime_error("Nie wybrano żadnego zadania.");
  if (sel.channels.empty()) throw std::runtime_error("Nie wybrano żadnej elektrody.");
  for (const auto& id : sel.task_ids) find_task(id);
  return sel;
}

std::vector<RecordJob> resolve_records(const Selection& sel, const DatasetIndex& index,
                                       std::size_t max_subjects) {
  std::vector<std::string> subjects = sel.all_subjects ? index.list_subjects() : sel.subjects;
  std::sort(subjects.begin(), subjects.end());
  if (max_subjects > 0 && subjects.size() > max_subjects) subjects.resize(max_subjects);

  std::vector<RecordJob> jobs;
  for (const auto& subject : subjects) {
    for (const auto& task_id : sel.task_ids) {
      const std::size_t t = find_task(task_id);
      for (int run : task_types()[t].runs) {
        const std::string id = record_id_for(subject, run);
        const auto path = index.resolve_path(id);
        if (!std::filesystem::exists(path)) continue;
        jobs.push_back({subject, id, path.string(), t});
      }
    }
  }
  return jobs;
}

}
