#pragma once

#include "dataset_index.h"

#include <nlohmann/json.hpp>

#include <string>
#include <vector>

namespace eeg::analysis {

struct TaskType {
  std::string id;
  std::string name;
  std::vector<int> runs;
  std::string t1_name;
  std::string t2_name;
};

const std::vector<TaskType>& task_types();

struct RecordJob {
  std::string subject_id;
  std::string record_id;
  std::string path;
  std::size_t task_index;
};

struct Selection {
  bool all_subjects = true;
  std::vector<std::string> subjects;
  std::vector<std::string> task_ids;
  std::vector<std::string> channels;
};

Selection parse_selection(const nlohmann::json& data_selection);

std::vector<RecordJob> resolve_records(const Selection& sel, const DatasetIndex& index,
                                       std::size_t max_subjects = 0);

}
