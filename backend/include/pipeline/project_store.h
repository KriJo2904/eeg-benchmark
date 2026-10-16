#pragma once

#include <nlohmann/json.hpp>

#include <string>

namespace eeg::pipeline {

struct ProjectData {
  nlohmann::json pipeline;
  nlohmann::json data_selection;
};

class ProjectStore {
 public:
  explicit ProjectStore(std::string base_url) : base_url_(std::move(base_url)) {}

  ProjectData fetch_project_data(const std::string& project_id) const;

  void save_analysis(const std::string& project_id, const nlohmann::json& documents) const;

 private:
  std::string base_url_;
};

}
