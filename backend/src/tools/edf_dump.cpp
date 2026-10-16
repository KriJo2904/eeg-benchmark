#include "edf_reader.h"

#include <array>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <cstring>
#include <string>

extern "C" {
#include "edflib.h"
}

static void usage() {
  std::cerr << "Usage:\n";
  std::cerr << "  edf_dump <path.edf> [channelLabel] [t0] [t1] [decimate]\n";
  std::cerr << "\n";
  std::cerr << "Examples:\n";
  std::cerr << "  edf_dump \".../S002/S002R01.edf\"\n";
  std::cerr << "  edf_dump \".../S002/S002R01.edf\" C3 0 10 4\n";
}

static const char* edflib_filetype_name(int filetype) {
  switch (filetype) {
    case EDFLIB_FILETYPE_EDF:
      return "EDF";
    case EDFLIB_FILETYPE_EDFPLUS:
      return "EDF+";
    case EDFLIB_FILETYPE_BDF:
      return "BDF";
    case EDFLIB_FILETYPE_BDFPLUS:
      return "BDF+";
    default:
      return nullptr;
  }
}

static const char* edflib_err_name(int code) {
  switch (code) {
    case EDFLIB_MALLOC_ERROR:
      return "EDFLIB_MALLOC_ERROR";
    case EDFLIB_NO_SUCH_FILE_OR_DIRECTORY:
      return "EDFLIB_NO_SUCH_FILE_OR_DIRECTORY";
    case EDFLIB_FILE_CONTAINS_FORMAT_ERRORS:
      return "EDFLIB_FILE_CONTAINS_FORMAT_ERRORS";
    case EDFLIB_MAXFILES_REACHED:
      return "EDFLIB_MAXFILES_REACHED";
    case EDFLIB_FILE_READ_ERROR:
      return "EDFLIB_FILE_READ_ERROR";
    case EDFLIB_FILE_ALREADY_OPENED:
      return "EDFLIB_FILE_ALREADY_OPENED";
    case EDFLIB_FILETYPE_ERROR:
      return "EDFLIB_FILETYPE_ERROR";
    case EDFLIB_FILE_IS_DISCONTINUOUS:
      return "EDFLIB_FILE_IS_DISCONTINUOUS";
    default:
      return "UNKNOWN";
  }
}

static std::string field(const std::vector<char>& buf, std::size_t off, std::size_t len) {
  if (off + len > buf.size()) return "(truncated)";
  std::string s(buf.data() + off, len);
  while (!s.empty() && s.back() == ' ') s.pop_back();
  return s;
}

static void dump_header_preview(const std::filesystem::path& path) {
  std::cout << "fs:\n";
  std::cout << "  exists: " << (std::filesystem::exists(path) ? "yes" : "no") << "\n";
  if (!std::filesystem::exists(path)) return;
  const auto sz = std::filesystem::file_size(path);
  std::cout << "  size: " << sz << " bytes\n";

  std::ifstream ifs(path, std::ios::binary);
  if (!ifs) {
    std::cout << "  open_ifstream: FAILED\n";
    return;
  }

  std::vector<char> hdr(256);
  ifs.read(hdr.data(), 256);
  const auto got = static_cast<std::size_t>(ifs.gcount());
  std::cout << "  read256: " << got << " bytes\n";
  if (got < 256) {
    std::cout << "  (header too short)\n";
    return;
  }

  std::cout << "raw_edf_header:\n";
  std::cout << "  version: \"" << field(hdr, 0, 8) << "\"\n";
  std::cout << "  patient: \"" << field(hdr, 8, 80) << "\"\n";
  std::cout << "  recording: \"" << field(hdr, 88, 80) << "\"\n";
  std::cout << "  startdate: \"" << field(hdr, 168, 8) << "\"\n";
  std::cout << "  starttime: \"" << field(hdr, 176, 8) << "\"\n";
  std::cout << "  header_bytes: \"" << field(hdr, 184, 8) << "\"\n";
  std::cout << "  reserved: \"" << field(hdr, 192, 44) << "\"\n";
  std::cout << "  num_records: \"" << field(hdr, 236, 8) << "\"\n";
  std::cout << "  record_duration: \"" << field(hdr, 244, 8) << "\"\n";
  std::cout << "  num_signals: \"" << field(hdr, 252, 4) << "\"\n";

  int ns = 0;
  try { ns = std::stoi(field(hdr, 252, 4)); } catch (...) { return; }
  if (ns <= 0 || ns > 512) return;

  const std::size_t full_hdr_size = 256 + static_cast<std::size_t>(ns) * 256;
  std::vector<char> full(full_hdr_size);
  ifs.seekg(0);
  ifs.read(full.data(), static_cast<std::streamsize>(full_hdr_size));
  if (static_cast<std::size_t>(ifs.gcount()) < full_hdr_size) {
    std::cout << "  (could not read full header, got " << ifs.gcount() << "/" << full_hdr_size << ")\n";
    return;
  }

  const std::size_t base = 256;
  const std::size_t label_off       = base;
  const std::size_t transducer_off  = label_off      + static_cast<std::size_t>(ns) * 16;
  const std::size_t physdim_off     = transducer_off + static_cast<std::size_t>(ns) * 80;
  const std::size_t physmin_off     = physdim_off    + static_cast<std::size_t>(ns) * 8;
  const std::size_t physmax_off     = physmin_off    + static_cast<std::size_t>(ns) * 8;
  const std::size_t digmin_off      = physmax_off    + static_cast<std::size_t>(ns) * 8;
  const std::size_t digmax_off      = digmin_off     + static_cast<std::size_t>(ns) * 8;
  const std::size_t prefilter_off   = digmax_off     + static_cast<std::size_t>(ns) * 8;
  const std::size_t samples_off     = prefilter_off  + static_cast<std::size_t>(ns) * 80;
  const std::size_t reserved_off    = samples_off    + static_cast<std::size_t>(ns) * 8;

  std::cout << "\nper_signal_header:\n";
  for (int i = 0; i < ns; ++i) {
    const auto si = static_cast<std::size_t>(i);
    std::cout << "  sig[" << i << "]:\n";
    std::cout << "    label: \"" << field(full, label_off + si * 16, 16) << "\"\n";
    std::cout << "    physdim: \"" << field(full, physdim_off + si * 8, 8) << "\"\n";
    std::cout << "    phys_min: \"" << field(full, physmin_off + si * 8, 8) << "\"\n";
    std::cout << "    phys_max: \"" << field(full, physmax_off + si * 8, 8) << "\"\n";
    std::cout << "    dig_min: \"" << field(full, digmin_off + si * 8, 8) << "\"\n";
    std::cout << "    dig_max: \"" << field(full, digmax_off + si * 8, 8) << "\"\n";
    std::cout << "    samples: \"" << field(full, samples_off + si * 8, 8) << "\"\n";
    std::cout << "    reserved: \"" << field(full, reserved_off + si * 32, 32) << "\"\n";
  }
}

static void try_open_edflib(const std::filesystem::path& path, int read_annotations) {
  edf_hdr_struct hdr;
  std::memset(&hdr, 0, sizeof(hdr));
  const int h = edfopen_file_readonly(path.string().c_str(), &hdr, read_annotations);
  std::cout << "edflib_open:\n";
  std::cout << "  read_annotations: " << read_annotations << "\n";
  std::cout << "  handle: " << h << "\n";
  if (const char* ft = edflib_filetype_name(hdr.filetype)) {
    std::cout << "  hdr.filetype: " << hdr.filetype << " (" << ft << ")\n";
  } else {
    std::cout << "  hdr.filetype: " << hdr.filetype << " (" << edflib_err_name(hdr.filetype) << ")\n";
  }
  if (h < 0) {
    return;
  }
  std::cout << "  edfsignals: " << hdr.edfsignals << "\n";
  std::cout << "  annotations_in_file: " << hdr.annotations_in_file << "\n";
  edfclose_file(h);
}

int main(int argc, char** argv) {
  if (argc < 2) {
    usage();
    return 2;
  }

  const std::filesystem::path path = argv[1];
  const std::string channel = (argc >= 3) ? argv[2] : "C3";
  const double t0 = (argc >= 4) ? std::stod(argv[3]) : 0.0;
  const double t1 = (argc >= 5) ? std::stod(argv[4]) : 10.0;
  const int decimate = (argc >= 6) ? std::stoi(argv[5]) : 1;

  try {
    dump_header_preview(path);
    std::cout << "\n";
    try_open_edflib(path, EDFLIB_READ_ALL_ANNOTATIONS);
    try_open_edflib(path, EDFLIB_READ_ANNOTATIONS);
    try_open_edflib(path, EDFLIB_DO_NOT_READ_ANNOTATIONS);
    std::cout << "\n";

    eeg::EdfReader r;
    const auto meta = r.read_metadata(path, path.filename().string());

    std::cout << "file: " << path.string() << "\n";
    std::cout << "durationSec: " << meta.duration_sec << "\n";
    std::cout << "signalsInFile: " << meta.signals_in_file << "\n";
    std::cout << "hasAnnotations: " << (meta.has_annotations ? "yes" : "no") << "\n";
    std::cout << "channels:\n";
    for (const auto& c : meta.channels) {
      std::cout << "  [" << c.index << "] " << c.label << "  fs=" << c.sample_rate_hz << "Hz  unit=" << c.unit << "\n";
    }

    std::cout << "\nwindow:\n";
    const auto win = r.read_window(path, channel, t0, t1, decimate);
    std::cout << "  channel: " << win.channel_label << "\n";
    std::cout << "  t0: " << win.t0 << "\n";
    std::cout << "  sampleRateHz: " << win.sample_rate_hz << "\n";
    std::cout << "  decimate: " << win.decimate << "\n";
    std::cout << "  samples: " << win.samples.size() << "\n";
    for (std::size_t i = 0; i < std::min<std::size_t>(win.samples.size(), 10); ++i) {
      std::cout << "    " << win.samples[i] << "\n";
    }

    std::cout << "\nevents:\n";
    const auto evs = r.read_events(path);
    std::cout << "  count: " << evs.size() << "\n";
    for (std::size_t i = 0; i < std::min<std::size_t>(evs.size(), 20); ++i) {
      std::cout << "  - onset=" << evs[i].onset_sec << " dur=" << evs[i].duration_sec << " desc=" << evs[i].description
                << "\n";
    }
  } catch (const std::exception& e) {
    std::cerr << "error: " << e.what() << "\n";
    return 1;
  }

  return 0;
}

