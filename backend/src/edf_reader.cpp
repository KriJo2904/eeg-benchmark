#include "edf_reader.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <mutex>
#include <stdexcept>

extern "C" {
#include "edflib.h"
}

namespace eeg {

static std::mutex edflib_mutex;

struct OpenEdf {
  int handle = -1;
  edf_hdr_struct header{};

  OpenEdf() = default;
  ~OpenEdf() {
    if (handle >= 0) edfclose_file(handle);
  }
  OpenEdf(const OpenEdf&) = delete;
  OpenEdf& operator=(const OpenEdf&) = delete;
};

static bool try_open(OpenEdf& file, const std::filesystem::path& path, int how_to_read_annotations) {
  std::memset(&file.header, 0, sizeof(file.header));
  file.handle = edfopen_file_readonly(path.string().c_str(), &file.header, how_to_read_annotations);
  return file.handle >= 0;
}

static bool open_with_retries(OpenEdf& file, const std::filesystem::path& path, int preferred_mode) {
  if (try_open(file, path, preferred_mode)) return true;
  if (try_open(file, path, EDFLIB_READ_ANNOTATIONS)) return true;
  return try_open(file, path, EDFLIB_DO_NOT_READ_ANNOTATIONS);
}

static void throw_if_not_opened(bool opened, const std::filesystem::path& path, const edf_hdr_struct& header) {
  if (!opened) {
    throw std::runtime_error("Nie można otworzyć pliku EDF (kod błędu " + std::to_string(header.filetype) +
                             "): " + path.string());
  }
}

static std::string trim_spaces(std::string text) {
  while (!text.empty() && (text.back() <= ' ' || text.back() == '\0')) text.pop_back();
  while (!text.empty() && text.front() <= ' ') text.erase(text.begin());
  return text;
}

static std::string label_for_match(std::string text) {
  text = trim_spaces(std::move(text));
  while (!text.empty() && text.back() == '.') text.pop_back();
  return text;
}

static double channel_sample_rate_hz(const edf_param_struct& channel, long long datarecord_duration_us) {
  double samples_per_datarecord = static_cast<double>(channel.smp_in_datarecord);
  double datarecord_duration = static_cast<double>(datarecord_duration_us);
  return samples_per_datarecord / datarecord_duration * EDFLIB_TIME_DIMENSION;
}

RecordMetadata EdfReader::read_metadata(const std::filesystem::path& path, const std::string& record_id) const {
  std::lock_guard<std::mutex> whole_call(edflib_mutex);
  OpenEdf file;
  const bool opened = open_with_retries(file, path, EDFLIB_READ_ALL_ANNOTATIONS);
  throw_if_not_opened(opened, path, file.header);

  RecordMetadata result;
  result.record_id = record_id;
  result.signals_in_file = file.header.edfsignals;
  result.has_annotations = file.header.annotations_in_file > 0;
  result.duration_sec = file.header.file_duration / static_cast<double>(EDFLIB_TIME_DIMENSION);

  result.channels.reserve(file.header.edfsignals);
  for (int i = 0; i < file.header.edfsignals; ++i) {
    const edf_param_struct& channel = file.header.signalparam[i];
    result.channels.push_back({i,
                             trim_spaces(channel.label),
                             trim_spaces(channel.physdimension),
                             channel_sample_rate_hz(channel, file.header.datarecord_duration)});
  }
  return result;
}

SignalWindow EdfReader::read_window(const std::filesystem::path& path,
                                    const std::string& channel_name,
                                    double t0_seconds,
                                    double t1_seconds,
                                    int decimate) const {
  if (!(t1_seconds > t0_seconds)) {
    throw std::runtime_error("Nieprawidłowe okno czasu (t1 musi być większe niż t0).");
  }
  if (decimate < 1) decimate = 1;

  std::lock_guard<std::mutex> whole_call(edflib_mutex);
  OpenEdf file;
  const bool opened = open_with_retries(file, path, EDFLIB_DO_NOT_READ_ANNOTATIONS);
  throw_if_not_opened(opened, path, file.header);

  const std::string wanted = label_for_match(channel_name);
  int channel_index = -1;
  for (int i = 0; i < file.header.edfsignals; ++i) {
    if (label_for_match(file.header.signalparam[i].label) == wanted) {
      channel_index = i;
      break;
    }
  }
  if (channel_index < 0) {
    throw std::runtime_error("Nie ma kanału o nazwie: " + channel_name);
  }

  const edf_param_struct& channel = file.header.signalparam[channel_index];
  const double sample_rate = channel_sample_rate_hz(channel, file.header.datarecord_duration);

  const long long first_sample = static_cast<long long>(std::floor(t0_seconds * sample_rate));
  const long long last_sample = static_cast<long long>(std::ceil(t1_seconds * sample_rate));
  const long long sample_count = last_sample - first_sample;

  if (edfseek(file.handle, channel_index, first_sample, EDFSEEK_SET) < 0) {
    throw std::runtime_error("Błąd pozycjonowania w pliku (edfseek).");
  }

  std::vector<double> all_samples(static_cast<std::size_t>(std::max(0LL, sample_count)));
  long long read_so_far = 0;
  while (read_so_far < sample_count) {
    int batch = static_cast<int>(std::min<long long>(sample_count - read_so_far, 4096));
    int returned = edfread_physical_samples(file.handle, channel_index, batch, all_samples.data() + read_so_far);
    if (returned <= 0) break;
    read_so_far += returned;
  }
  all_samples.resize(static_cast<std::size_t>(read_so_far));

  SignalWindow window;
  window.channel_label = channel_name;
  window.t0 = t0_seconds;
  window.sample_rate_hz = sample_rate;
  window.decimate = decimate;

  if (decimate <= 1) {
    window.samples = std::move(all_samples);
  } else {
    const std::size_t step = static_cast<std::size_t>(decimate);
    window.samples.reserve((all_samples.size() + step - 1) / step);
    for (std::size_t i = 0; i < all_samples.size(); i += step) {
      window.samples.push_back(all_samples[i]);
    }
  }
  return window;
}

std::vector<Event> EdfReader::read_events(const std::filesystem::path& path) const {
  std::lock_guard<std::mutex> whole_call(edflib_mutex);
  OpenEdf file;
  const bool opened = open_with_retries(file, path, EDFLIB_READ_ALL_ANNOTATIONS);
  throw_if_not_opened(opened, path, file.header);

  std::vector<Event> result;
  result.reserve(static_cast<std::size_t>(std::max(0LL, file.header.annotations_in_file)));

  edf_annotation_struct annotation;
  for (int i = 0; i < file.header.annotations_in_file; ++i) {
    if (edf_get_annotation(file.handle, i, &annotation) != 0) continue;

    double duration_seconds = 0.0;
    if (annotation.duration[0] != '\0') {
      try {
        duration_seconds = std::stod(std::string(annotation.duration));
      } catch (...) {
        duration_seconds = 0.0;
      }
    }

    Event event;
    event.onset_sec = annotation.onset / static_cast<double>(EDFLIB_TIME_DIMENSION);
    event.duration_sec = duration_seconds;
    event.description = annotation.annotation;
    result.push_back(std::move(event));
  }
  return result;
}

struct EdfSignalHeader {
  std::string label;
  double phys_min = 0.0, phys_max = 0.0;
  double dig_min = 0.0, dig_max = 0.0;
  int samples_per_record = 0;
};

struct EdfHeader {
  long long header_bytes = 0;
  long long n_records = 0;
  double record_sec = 0.0;
  std::vector<EdfSignalHeader> signals;
};

static std::string edf_field(const std::string& bytes, std::size_t offset, std::size_t width) {
  if (offset + width > bytes.size()) throw std::runtime_error("Uszkodzony nagłówek EDF.");
  return trim_spaces(bytes.substr(offset, width));
}

static double edf_number(const std::string& bytes, std::size_t offset, std::size_t width) {
  return std::stod(edf_field(bytes, offset, width));
}

static EdfHeader parse_edf_header(const std::string& bytes) {
  EdfHeader h;
  h.header_bytes = static_cast<long long>(edf_number(bytes, 184, 8));
  h.n_records = static_cast<long long>(edf_number(bytes, 236, 8));
  h.record_sec = edf_number(bytes, 244, 8);
  const std::size_t ns = static_cast<std::size_t>(edf_number(bytes, 252, 4));

  h.signals.resize(ns);
  for (std::size_t i = 0; i < ns; ++i) {
    auto& sig = h.signals[i];
    sig.label = edf_field(bytes, 256 + i * 16, 16);
    sig.phys_min = edf_number(bytes, 256 + ns * 104 + i * 8, 8);
    sig.phys_max = edf_number(bytes, 256 + ns * 112 + i * 8, 8);
    sig.dig_min = edf_number(bytes, 256 + ns * 120 + i * 8, 8);
    sig.dig_max = edf_number(bytes, 256 + ns * 128 + i * 8, 8);
    sig.samples_per_record = static_cast<int>(edf_number(bytes, 256 + ns * 216 + i * 8, 8));
  }
  return h;
}

static std::string read_whole_file(const std::filesystem::path& path) {
  std::ifstream in(path, std::ios::binary);
  if (!in) throw std::runtime_error("Nie można otworzyć pliku EDF: " + path.string());
  in.seekg(0, std::ios::end);
  std::string bytes(static_cast<std::size_t>(in.tellg()), '\0');
  in.seekg(0, std::ios::beg);
  in.read(bytes.data(), static_cast<std::streamsize>(bytes.size()));
  return bytes;
}

static SignalWindow extract_channel(const std::string& bytes, const EdfHeader& h, std::size_t idx) {
  long long record_samples = 0, offset = 0;
  for (std::size_t i = 0; i < h.signals.size(); ++i) {
    if (i == idx) offset = record_samples;
    record_samples += h.signals[i].samples_per_record;
  }
  long long n_records = h.n_records;
  if (n_records <= 0) n_records = (static_cast<long long>(bytes.size()) - h.header_bytes) / (record_samples * 2);

  const auto& sig = h.signals[idx];
  const double gain = (sig.phys_max - sig.phys_min) / (sig.dig_max - sig.dig_min);

  SignalWindow w;
  w.channel_label = sig.label;
  w.sample_rate_hz = sig.samples_per_record / h.record_sec;
  w.samples.reserve(static_cast<std::size_t>(n_records * sig.samples_per_record));
  for (long long r = 0; r < n_records; ++r) {
    const long long first = h.header_bytes + (r * record_samples + offset) * 2;
    for (int k = 0; k < sig.samples_per_record; ++k) {
      const std::size_t p = static_cast<std::size_t>(first + k * 2);
      if (p + 1 >= bytes.size()) return w;
      const auto lo = static_cast<unsigned char>(bytes[p]);
      const auto hi = static_cast<signed char>(bytes[p + 1]);
      const int digital = hi * 256 + lo;
      w.samples.push_back(gain * (digital - sig.dig_min) + sig.phys_min);
    }
  }
  return w;
}

std::vector<SignalWindow> EdfReader::read_channels(const std::filesystem::path& path,
                                                   const std::vector<std::string>& channel_names) const {
  const std::string bytes = read_whole_file(path);
  const EdfHeader header = parse_edf_header(bytes);

  std::vector<SignalWindow> result;
  for (const auto& name : channel_names) {
    std::size_t idx = header.signals.size();
    for (std::size_t i = 0; i < header.signals.size(); ++i) {
      if (label_for_match(header.signals[i].label) == label_for_match(name)) idx = i;
    }
    if (idx == header.signals.size()) throw std::runtime_error("Nie ma kanału o nazwie: " + name);

    SignalWindow w = extract_channel(bytes, header, idx);
    w.channel_label = name;
    result.push_back(std::move(w));
  }
  return result;
}

}
