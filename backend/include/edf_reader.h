#pragma once

#include <filesystem>
#include <string>
#include <vector>

namespace eeg {

struct ChannelInfo {
  int index = -1;
  std::string label;
  std::string unit;
  double sample_rate_hz = 0.0;
};

struct RecordMetadata {
  std::string record_id;
  std::vector<ChannelInfo> channels;
  double duration_sec = 0.0;
  int signals_in_file = 0;
  bool has_annotations = false;
};

struct SignalWindow {
  std::string channel_label;
  double t0 = 0.0;
  double sample_rate_hz = 0.0;
  int decimate = 1;
  std::vector<double> samples;
};

struct Event {
  double onset_sec = 0.0;
  double duration_sec = 0.0;
  std::string description;
};

class EdfReader {
 public:
  RecordMetadata read_metadata(const std::filesystem::path& path, const std::string& record_id) const;
  SignalWindow read_window(const std::filesystem::path& path,
                           const std::string& channel_name,
                           double t0_seconds,
                           double t1_seconds,
                           int decimate) const;
  std::vector<Event> read_events(const std::filesystem::path& path) const;

  std::vector<SignalWindow> read_channels(const std::filesystem::path& path,
                                          const std::vector<std::string>& channel_names) const;
};

}
