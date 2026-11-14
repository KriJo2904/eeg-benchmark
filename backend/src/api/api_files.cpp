#include "api/api.h"
#include "api/json.h"

#include <nlohmann/json.hpp>
#include <sys/stat.h>

#include <ctime>
#include <filesystem>

namespace eeg::api {
using json = nlohmann::json;
namespace fs = std::filesystem;

namespace {

const std::size_t MAX_ENTRIES = 50000;

std::string modified_iso(const fs::path& path) {
  struct stat st {};
  if (stat(path.c_str(), &st) != 0) return "";
  std::tm tm {};
  gmtime_r(&st.st_mtime, &tm);
  char buf[32];
  std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tm);
  return buf;
}

json list_files(const fs::path& root, bool& truncated) {
  json files = json::array();
  truncated = false;
  fs::recursive_directory_iterator it(root, fs::directory_options::skip_permission_denied);
  for (; it != fs::recursive_directory_iterator(); ++it) {
    const fs::path& path = it->path();
    if (path.filename().string().front() == '.') {
      if (it->is_directory()) it.disable_recursion_pending();
      continue;
    }
    if (files.size() >= MAX_ENTRIES) {
      truncated = true;
      break;
    }
    const bool dir = it->is_directory();
    json item{{"name", path.filename().string()},
              {"path", "/" + fs::relative(path, root).generic_string()},
              {"isDirectory", dir},
              {"updatedAt", modified_iso(path)}};
    if (!dir) {
      std::error_code ec;
      const auto size = fs::file_size(path, ec);
      if (!ec) item["size"] = size;
    }
    files.push_back(item);
  }
  return files;
}

json body_json(const httplib::Request& req) {
  json body = json::parse(req.body, nullptr, false);
  if (body.is_discarded() || !body.is_object()) throw std::invalid_argument("Niepoprawne ciało zapytania.");
  return body;
}

std::string body_string(const json& body, const char* key) {
  if (!body.contains(key) || !body[key].is_string()) {
    throw std::invalid_argument(std::string("Brak pola ") + key + ".");
  }
  return body[key].get<std::string>();
}

template <typename Handler>
void handle(httplib::Response& res, Handler handler) {
  try {
    handler();
  } catch (const std::exception& e) {
    json_error(res, 400, e.what());
  }
}

json download_json(const DownloadInfo& d) {
  return {{"id", d.id},       {"url", d.url},     {"name", d.name}, {"state", d.state},
          {"error", d.error}, {"bytes", d.bytes}, {"total", d.total}};
}

}

void register_files(httplib::Server& svr, AppContext& ctx) {
  svr.Get("/api/files", [&ctx](const httplib::Request&, httplib::Response& res) {
    handle(res, [&] {
      bool truncated = false;
      json files = list_files(ctx.data.root(), truncated);
      json_ok(res, json{{"files", files}, {"truncated", truncated}});
    });
  });

  svr.Post("/api/files/folder", [&ctx](const httplib::Request& req, httplib::Response& res) {
    handle(res, [&] {
      const fs::path path = ctx.data.resolve(body_string(body_json(req), "path"));
      if (!valid_name(path.filename().string())) throw std::invalid_argument("Niepoprawna nazwa folderu.");
      if (fs::exists(path)) throw std::invalid_argument("Taki folder już istnieje.");
      if (!fs::is_directory(path.parent_path())) throw std::invalid_argument("Nie ma folderu nadrzędnego.");
      fs::create_directory(path);
      json_ok(res, json{{"ok", true}});
    });
  });

  svr.Post("/api/files/rename", [&ctx](const httplib::Request& req, httplib::Response& res) {
    handle(res, [&] {
      const json body = body_json(req);
      const fs::path from = ctx.data.resolve(body_string(body, "path"));
      const std::string name = body_string(body, "name");
      if (from == ctx.data.root() || !fs::exists(from)) throw std::invalid_argument("Nie ma takiego pliku.");
      if (!valid_name(name)) throw std::invalid_argument("Niepoprawna nazwa.");
      const fs::path to = from.parent_path() / name;
      if (fs::exists(to)) throw std::invalid_argument("Plik o tej nazwie już istnieje.");
      fs::rename(from, to);
      ctx.data.clear();
      json_ok(res, json{{"ok", true}});
    });
  });

  svr.Delete("/api/files", [&ctx](const httplib::Request& req, httplib::Response& res) {
    handle(res, [&] {
      const fs::path path = ctx.data.resolve(req.get_param_value("path"));
      if (path == ctx.data.root()) throw std::invalid_argument("Nie można usunąć katalogu danych.");
      if (!fs::exists(path)) throw std::invalid_argument("Nie ma takiego pliku.");
      fs::remove_all(path);
      ctx.data.clear();
      json_ok(res, json{{"ok", true}});
    });
  });

  svr.Get("/api/datasets/check", [&ctx](const httplib::Request& req, httplib::Response& res) {
    handle(res, [&] {
      const std::string path = req.get_param_value("path");
      auto index = ctx.data.dataset(path);
      json_ok(res, json{{"path", path},
                        {"subjects", index->list_subjects().size()},
                        {"records", index->list_records().size()}});
    });
  });

  svr.Get("/api/downloads", [&ctx](const httplib::Request&, httplib::Response& res) {
    json arr = json::array();
    for (const auto& d : ctx.downloads.list()) arr.push_back(download_json(d));
    json_ok(res, json{{"downloads", arr}});
  });

  svr.Post("/api/downloads", [&ctx](const httplib::Request& req, httplib::Response& res) {
    handle(res, [&] {
      const json body = body_json(req);
      const int id = ctx.downloads.start(body_string(body, "url"), body_string(body, "name"));
      json_ok(res, json{{"id", id}}, 201);
    });
  });

  svr.Delete(R"(/api/downloads/(\d+))", [&ctx](const httplib::Request& req, httplib::Response& res) {
    handle(res, [&] {
      ctx.downloads.cancel_or_remove(std::stoi(req.matches[1].str()));
      json_ok(res, json{{"ok", true}});
    });
  });
}

}
