#!/usr/bin/env bash
# Maszyna z backendem: buduje i uruchamia eeg_server natywnie (bez Dockera).
# Użycie: ./start-backend.sh [adres maszyny z aplikacją]
#   ./start-backend.sh                  aplikacja na tej samej maszynie (127.0.0.1:3000)
#   ./start-backend.sh 192.168.1.10     aplikacja na innej maszynie, port 3000 dopisze się sam
# Zmienne: EEG_DATA_DIR (katalog ze zbiorami, domyślnie backend/dane), PORT (domyślnie 8080).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

adres_lan() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "<IP tej maszyny>"
}

API="${1:-${PROJECTS_API_URL:-127.0.0.1}}"
case "$API" in http://*|https://*) ;; *) API="http://$API" ;; esac
API="${API%/}"
HOSTPORT="${API#*://}"
case "$HOSTPORT" in *:*) ;; *) API="$API:3000" ;; esac

DANE="${EEG_DATA_DIR:-$ROOT/backend/dane}"
PORT="${PORT:-8080}"

for program in curl unzip tar; do
  command -v "$program" >/dev/null || echo "UWAGA: brak programu $program, pobieranie danych z linku nie zadziała."
done

cmake -S backend -B backend/build -DCMAKE_BUILD_TYPE=Release
cmake --build backend/build -j --target eeg_server

if ! command -v curl >/dev/null; then
  echo "Brak curl, pomijam sprawdzenie projects-api ($API)."
elif curl -s -m 3 -o /dev/null "$API/health"; then
  echo "projects-api odpowiada: $API"
else
  echo "UWAGA: projects-api nie odpowiada pod $API."
  echo "Backend wystartuje, ale analiza nie zadziała, dopóki aplikacja nie będzie dostępna pod tym adresem."
fi

echo
echo "Backend tej maszyny: http://$(adres_lan):$PORT"
echo "Ten adres wpisz na froncie w panelu Backend."
echo "Ctrl+C zatrzymuje backend."
echo

exec env HOST=0.0.0.0 PORT="$PORT" EEG_DATA_DIR="$DANE" PROJECTS_API_URL="$API" backend/build/eeg_server
