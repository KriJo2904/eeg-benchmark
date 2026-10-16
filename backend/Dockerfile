FROM ubuntu:24.04 AS build

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git ca-certificates curl pkg-config \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY backend/CMakeLists.txt /src/backend/CMakeLists.txt
COPY backend/include /src/backend/include
COPY backend/src /src/backend/src
COPY backend/third_party /src/backend/third_party

RUN cmake -S /src/backend -B /src/backend/build -DCMAKE_BUILD_TYPE=Release \
 && cmake --build /src/backend/build -j

FROM ubuntu:24.04 AS runtime
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /src/backend/build/eeg_server /app/eeg_server
COPY --from=build /src/backend/build/edf_dump /app/edf_dump

EXPOSE 8080
ENV HOST=0.0.0.0
ENV PORT=8080
ENV EEG_DATASET_ROOT=/data/eegmmidb

CMD ["/app/eeg_server"]

