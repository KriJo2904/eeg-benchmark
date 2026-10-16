#include "pipeline/project_store.h"

#include "httplib.h"

#include <stdexcept>

namespace eeg::pipeline {

ProjectData ProjectStore::fetch_project_data(const std::string& project_id) const {
  httplib::Client cli(base_url_);
  cli.set_connection_timeout(3, 0);
  cli.set_read_timeout(5, 0);

  const std::string path = "/projects/" + project_id;
  auto res = cli.Get(path.c_str());
  if (!res) {
    throw std::runtime_error("projects-api unreachable at " + base_url_);
  }
  if (res->status == 404) {
    throw std::runtime_error("project not found: " + project_id);
  }
  if (res->status != 200) {
    throw std::runtime_error("projects-api returned HTTP " + std::to_string(res->status));
  }

  nlohmann::json body = nlohmann::json::parse(res->body, nullptr,false);
  if (body.is_discarded() || !body.contains("project")) {
    throw std::runtime_error("projects-api: malformed response");
  }
  const auto& project = body["project"];
  if (!project.contains("pipeline") || project["pipeline"].is_null()) {
    throw std::runtime_error("project has no pipeline saved");
  }

  ProjectData data;
  data.pipeline = project["pipeline"];
  data.data_selection = project.contains("dataSelection") ? project["dataSelection"] : nlohmann::json();
  return data;
}

void ProjectStore::save_analysis(const std::string& project_id,
                                 const nlohmann::json& documents) const {
  httplib::Client cli(base_url_);
  cli.set_connection_timeout(3, 0);
  cli.set_write_timeout(120, 0);
  cli.set_read_timeout(120, 0);

  const std::string path = "/projects/" + project_id + "/analysis";
  auto res = cli.Put(path.c_str(), documents.dump(), "application/json");
  if (!res) {
    throw std::runtime_error("Nie udało się zapisać wyniku: projects-api nie odpowiada (" + base_url_ + ")");
  }
  if (res->status != 200) {
    throw std::runtime_error("Zapis wyniku w bazie nie powiódł się (HTTP " + std::to_string(res->status) +
                             "): " + res->body);
  }
}

}
