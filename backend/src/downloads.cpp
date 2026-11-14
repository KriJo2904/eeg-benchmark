#include "downloads.h"

#include <fcntl.h>
#include <signal.h>
#include <spawn.h>
#include <sys/wait.h>

#include <algorithm>
#include <atomic>
#include <cctype>
#include <fstream>
#include <stdexcept>
#include <thread>

extern char** environ;

namespace eeg {

namespace fs = std::filesystem;

struct Downloads::Job {
  int id = 0;
  std::string url;
  std::string name;
  fs::path work_dir;
  fs::path archive;
  fs::path headers;

  std::mutex mutex;
  std::string state = "downloading";
  std::string error;
  std::uintmax_t total = 0;

  std::atomic<pid_t> pid{0};
  std::atomic<bool> cancelled{false};
};

namespace {

enum class Kind { Zip, Tar, Plain };

int run_program(const std::vector<std::string>& args, std::atomic<pid_t>& pid, const fs::path& log) {
  std::vector<char*> argv;
  for (const auto& a : args) argv.push_back(const_cast<char*>(a.c_str()));
  argv.push_back(nullptr);

  posix_spawn_file_actions_t actions;
  posix_spawn_file_actions_init(&actions);
  posix_spawn_file_actions_addopen(&actions, 1, log.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0644);
  posix_spawn_file_actions_adddup2(&actions, 1, 2);

  pid_t child = 0;
  const int err = posix_spawnp(&child, argv[0], &actions, nullptr, argv.data(), environ);
  posix_spawn_file_actions_destroy(&actions);
  if (err != 0) return -1;

  pid = child;
  int status = 0;
  waitpid(child, &status, 0);
  pid = 0;
  return WIFEXITED(status) ? WEXITSTATUS(status) : -1;
}

std::string last_line(const fs::path& path) {
  std::ifstream in(path);
  std::string line;
  std::string last;
  while (std::getline(in, line)) {
    if (!line.empty() && line.back() == '\r') line.pop_back();
    if (!line.empty()) last = line;
  }
  return last.size() > 300 ? last.substr(0, 300) : last;
}

std::string program_error(const std::string& program, int code, const fs::path& log) {
  const std::string msg = last_line(log);
  if (code == -1 && msg.empty()) return "nie udało się uruchomić programu " + program;
  if (msg.empty()) return program + ": kod wyjścia " + std::to_string(code);
  return msg.rfind(program + ":", 0) == 0 ? msg : program + ": " + msg;
}

std::uintmax_t content_length(const fs::path& headers) {
  std::ifstream in(headers);
  std::string line;
  std::uintmax_t length = 0;
  while (std::getline(in, line)) {
    std::string lower = line;
    std::transform(lower.begin(), lower.end(), lower.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (lower.rfind("http/", 0) == 0) length = 0;
    const std::string key = "content-length:";
    if (lower.rfind(key, 0) == 0) {
      try {
        length = std::stoull(lower.substr(key.size()));
      } catch (...) {
        length = 0;
      }
    }
  }
  return length;
}

Kind archive_kind(const fs::path& path) {
  std::ifstream in(path, std::ios::binary);
  std::string head(262, '\0');
  in.read(head.data(), static_cast<std::streamsize>(head.size()));
  head.resize(static_cast<std::size_t>(in.gcount()));

  auto starts = [&](const std::string& magic) { return head.compare(0, magic.size(), magic) == 0; };
  if (starts(std::string("PK\x03\x04", 4))) return Kind::Zip;
  if (starts("\x1f\x8b") || starts("BZh") || starts(std::string("\xfd" "7zXZ\0", 6))) return Kind::Tar;
  if (head.size() >= 262 && head.compare(257, 5, "ustar") == 0) return Kind::Tar;
  return Kind::Plain;
}

fs::path single_dir_chain(fs::path dir) {
  while (true) {
    std::vector<fs::path> entries;
    for (const auto& e : fs::directory_iterator(dir)) {
      const std::string name = e.path().filename().string();
      if (name == "__MACOSX" || name.front() == '.') continue;
      entries.push_back(e.path());
    }
    if (entries.size() != 1 || !fs::is_directory(entries[0])) return dir;
    dir = entries[0];
  }
}

std::string file_name_from_url(const std::string& url) {
  const std::string path = url.substr(0, url.find_first_of("?#"));
  const auto slash = path.find_last_of('/');
  const std::string name = slash == std::string::npos ? "" : path.substr(slash + 1);
  return valid_name(name) ? name : "plik";
}

struct Cancelled {};

}

Downloads::Downloads(DataStore& store) : store_(store) {
  for (const auto& e : fs::directory_iterator(store_.root())) {
    if (e.path().filename().string().rfind(".pobieranie-", 0) == 0) {
      std::error_code ec;
      fs::remove_all(e.path(), ec);
    }
  }
}

int Downloads::start(const std::string& url, const std::string& name) {
  if (url.rfind("http://", 0) != 0 && url.rfind("https://", 0) != 0) {
    throw std::invalid_argument("Link musi zaczynać się od http:// albo https://.");
  }
  if (!valid_name(name)) throw std::invalid_argument("Niepoprawna nazwa folderu.");
  if (fs::exists(store_.resolve(name))) throw std::invalid_argument("Folder " + name + " już istnieje.");

  auto job = std::make_shared<Job>();
  job->url = url;
  job->name = name;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto& j : jobs_) {
      std::lock_guard<std::mutex> job_lock(j->mutex);
      if (j->name == name && (j->state == "downloading" || j->state == "extracting")) {
        throw std::invalid_argument("Folder " + name + " już jest pobierany.");
      }
    }
    job->id = next_id_++;
    job->work_dir = store_.root() / (".pobieranie-" + std::to_string(job->id));
    job->archive = job->work_dir / "pobrany";
    job->headers = job->work_dir / "naglowki.txt";
    jobs_.push_back(job);
  }

  std::thread([this, job] { run(job); }).detach();
  return job->id;
}

void Downloads::run(std::shared_ptr<Job> job) {
  const fs::path log = job->work_dir / "log.txt";
  try {
    fs::create_directories(job->work_dir);

    int code = run_program({"curl", "-fL", "-sS", "--proto", "=http,https", "--proto-redir", "=http,https",
                            "-D", job->headers.string(), "-o", job->archive.string(), job->url},
                           job->pid, log);
    if (job->cancelled) throw Cancelled{};
    if (code != 0) throw std::runtime_error(program_error("curl", code, log));

    {
      std::lock_guard<std::mutex> lock(job->mutex);
      job->total = fs::file_size(job->archive);
      job->state = "extracting";
    }

    const fs::path out = job->work_dir / "rozpakowane";
    fs::create_directories(out);
    const Kind kind = archive_kind(job->archive);
    if (kind == Kind::Zip) {
      code = run_program({"unzip", "-q", job->archive.string(), "-d", out.string()}, job->pid, log);
      if (code == 1) code = 0;
      if (job->cancelled) throw Cancelled{};
      if (code != 0) throw std::runtime_error(program_error("unzip", code, log));
    } else if (kind == Kind::Tar) {
      code = run_program({"tar", "-xf", job->archive.string(), "-C", out.string()}, job->pid, log);
      if (job->cancelled) throw Cancelled{};
      if (code != 0) throw std::runtime_error(program_error("tar", code, log));
    } else {
      fs::rename(job->archive, out / file_name_from_url(job->url));
    }

    const fs::path source = kind == Kind::Plain ? out : single_dir_chain(out);
    const fs::path target = store_.resolve(job->name);
    if (fs::exists(target)) throw std::runtime_error("Folder " + job->name + " już istnieje.");
    fs::rename(source, target);
    store_.clear();

    std::lock_guard<std::mutex> lock(job->mutex);
    job->state = "done";
  } catch (const Cancelled&) {
    std::lock_guard<std::mutex> lock(job->mutex);
    job->state = "cancelled";
  } catch (const std::exception& e) {
    std::lock_guard<std::mutex> lock(job->mutex);
    job->state = job->cancelled ? "cancelled" : "error";
    job->error = job->cancelled ? "" : e.what();
  }

  std::error_code ec;
  fs::remove_all(job->work_dir, ec);
}

std::vector<DownloadInfo> Downloads::list() {
  std::vector<std::shared_ptr<Job>> jobs;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    jobs = jobs_;
  }

  std::vector<DownloadInfo> out;
  for (const auto& job : jobs) {
    std::lock_guard<std::mutex> lock(job->mutex);
    DownloadInfo info;
    info.id = job->id;
    info.url = job->url;
    info.name = job->name;
    info.state = job->state;
    info.error = job->error;
    if (job->state == "downloading") {
      std::error_code ec;
      const auto size = fs::file_size(job->archive, ec);
      info.bytes = ec ? 0 : size;
      info.total = content_length(job->headers);
    } else {
      info.bytes = job->total;
      info.total = job->total;
    }
    out.push_back(info);
  }
  return out;
}

void Downloads::cancel_or_remove(int id) {
  std::lock_guard<std::mutex> lock(mutex_);
  for (auto it = jobs_.begin(); it != jobs_.end(); ++it) {
    auto job = *it;
    std::lock_guard<std::mutex> job_lock(job->mutex);
    if (job->id != id) continue;
    if (job->state == "downloading" || job->state == "extracting") {
      job->cancelled = true;
      const pid_t pid = job->pid;
      if (pid > 0) kill(pid, SIGTERM);
    } else {
      jobs_.erase(it);
    }
    return;
  }
  throw std::invalid_argument("Nie ma takiego pobierania.");
}

}
