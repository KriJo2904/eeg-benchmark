#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.dev.yml)

cmake -S backend -B backend/build -DCMAKE_BUILD_TYPE=Release
cmake --build backend/build -j

"${COMPOSE[@]}" stop backend
"${COMPOSE[@]}" up -d --build frontend-dev mongo projects-api
trap '"${COMPOSE[@]}" stop frontend-dev mongo projects-api' EXIT

echo "Aplikacja: http://localhost:5173  (backend natywnie na :8080, Ctrl+C zatrzymuje wszystko)"
HOST=0.0.0.0 EEG_DATASET_ROOT="$ROOT/backend/eegmmidb" PROJECTS_API_URL=http://127.0.0.1:3000 \
  backend/build/eeg_server
