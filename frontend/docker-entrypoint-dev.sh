#!/bin/sh
set -e
cd /app
if ! [ -x node_modules/.bin/vite ]; then
  echo "[frontend-dev] Brak node_modules w volume — npm ci (pierwszy raz może potrwać)..."
  npm ci
fi
exec npm run dev -- --host 0.0.0.0 --port 5173
