#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

adres_lan() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "<IP tej maszyny>"
}

export FRONTEND_PORT="${FRONTEND_PORT:-5173}"

docker compose up -d --build --remove-orphans

IP="$(adres_lan)"
echo
echo "Aplikacja działa."
echo "  Frontend:     http://$IP:$FRONTEND_PORT"
echo "  projects-api: http://$IP:3000"
echo
echo "Na maszynie z backendem: ./start-backend.sh $IP"
echo "Logi: docker compose logs -f    Zatrzymanie: docker compose down"
