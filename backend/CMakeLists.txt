cmake_minimum_required(VERSION 3.24)
project(eeg_server LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

# --- nlohmann/json ---
FetchContent_Declare(nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG        v3.11.3
)
FetchContent_MakeAvailable(nlohmann_json)

# --- cpp-httplib ---
FetchContent_Declare(httplib
  GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
  GIT_TAG        v0.18.7
)
FetchContent_MakeAvailable(httplib)

if(NOT TARGET httplib::httplib)
  add_library(httplib::httplib INTERFACE IMPORTED)
  set_target_properties(httplib::httplib PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES "${httplib_SOURCE_DIR}"
  )
endif()

# --- pocketfft (header-only FFT, biblioteka pipeline'u do STFT) ---
FetchContent_Declare(pocketfft
  GIT_REPOSITORY https://github.com/mreineck/pocketfft.git
  GIT_TAG        cpp
)
FetchContent_Populate(pocketfft)
add_library(pocketfft INTERFACE)
target_include_directories(pocketfft INTERFACE "${pocketfft_SOURCE_DIR}")

# --- EDFlib (vendored, v1.26 with BCI2000 compat patch) ---
add_library(edflib STATIC third_party/edflib/edflib.c)
target_include_directories(edflib PUBLIC third_party/edflib)
target_compile_definitions(edflib PRIVATE _GNU_SOURCE _LARGEFILE64_SOURCE _FILE_OFFSET_BITS=64)

# --- Core library (EDF reader + dataset index) ---
add_library(eeg_core STATIC
  src/dataset_index.cpp
  src/edf_reader.cpp
)
target_include_directories(eeg_core PUBLIC include)
target_link_libraries(eeg_core PUBLIC edflib)

# --- Obliczenia STFT + thread pool ---
# Wspólne dla serwera i bench_pipeline, żeby benchmark mierzył dokładnie ten sam kod.
add_library(eeg_fft STATIC
  src/pipeline/fft_utils.cpp
  src/pipeline/stft.cpp
  src/pipeline/thread_pool.cpp
  src/pipeline/parallel_for.cpp
)
target_include_directories(eeg_fft PUBLIC include)
target_link_libraries(eeg_fft PUBLIC pocketfft nlohmann_json::nlohmann_json)
if(UNIX AND NOT APPLE)
  target_link_libraries(eeg_fft PUBLIC pthread)
endif()

# --- Server library (HTTP + API routes) ---
add_library(eeg_server_lib STATIC
  src/config.cpp
  src/http_server.cpp
  src/api/api.cpp
  src/api/api_records.cpp
  src/api/api_pipeline.cpp
  src/pipeline/block_registry.cpp
  src/pipeline/pipeline.cpp
  src/pipeline/project_store.cpp
  src/analysis/selection.cpp
  src/analysis/epochs.cpp
  src/analysis/analysis.cpp
  src/analysis/analysis_json.cpp
  src/analysis/benchmark.cpp
)
target_include_directories(eeg_server_lib PUBLIC include)
target_link_libraries(eeg_server_lib PUBLIC nlohmann_json::nlohmann_json httplib::httplib eeg_core eeg_fft)

# --- Bloki pipeline (samorejestrujące się) ---
# OBJECT library: dodanie nowego bloku = nowy plik w src/pipeline/blocks/.
# Linkowana wprost do exe, aby inicjalizatory statyczne (rejestracja) nie zostały odrzucone.
file(GLOB EEG_BLOCK_SOURCES CONFIGURE_DEPENDS src/pipeline/blocks/*.cpp)
add_library(eeg_blocks OBJECT ${EEG_BLOCK_SOURCES})
target_include_directories(eeg_blocks PUBLIC include)
target_link_libraries(eeg_blocks PUBLIC nlohmann_json::nlohmann_json eeg_fft)

# --- Executables ---
add_executable(eeg_server src/main.cpp $<TARGET_OBJECTS:eeg_blocks>)
target_link_libraries(eeg_server PRIVATE eeg_server_lib eeg_blocks eeg_fft)

add_executable(edf_dump src/tools/edf_dump.cpp)
target_link_libraries(edf_dump PRIVATE eeg_core)

add_executable(bench_pipeline src/tools/bench_pipeline.cpp)
target_link_libraries(bench_pipeline PRIVATE eeg_core eeg_fft)

# Benchmark całej analizy (odczyt EDF + epoki + pipeline) - ten sam kod co zakładka "Wydajność".
# Bloki pipeline'u linkowane wprost (OBJECT), żeby ich samorejestracja nie została odrzucona.
add_executable(bench_analysis src/tools/bench_analysis.cpp $<TARGET_OBJECTS:eeg_blocks>)
target_link_libraries(bench_analysis PRIVATE eeg_server_lib eeg_blocks)

if(UNIX AND NOT APPLE)
  target_link_libraries(eeg_server PRIVATE pthread)
  target_link_libraries(edf_dump PRIVATE pthread)
  target_link_libraries(bench_pipeline PRIVATE pthread)
  target_link_libraries(bench_analysis PRIVATE pthread)
endif()
