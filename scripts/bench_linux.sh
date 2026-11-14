#!/usr/bin/env bash
set -euo pipefail

PROJEKT="$(cd "$(dirname "$0")/.." && pwd)"
DANE="${1:-$HOME/eegmmidb}"
BADANI="${BADANI:-all}"
PRZEBIEGI="${PRZEBIEGI:-5}"
WYNIKI="$PROJEKT/wyniki_$(hostname)_$(date +%Y%m%d_%H%M)"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi

echo "== Instalacja kompilatora i narzędzi"
$SUDO apt-get update -q
$SUDO apt-get install -y -q build-essential cmake git unzip wget

if [ ! -d "$DANE/S001" ]; then
  echo "== Pobieranie EEGMMIDB z PhysioNet (ok. 2 GB)"
  mkdir -p "$DANE" "$HOME/eegmmidb_zip"
  wget -q --show-progress -O "$HOME/eegmmidb.zip" https://physionet.org/content/eegmmidb/get-zip/1.0.0/
  unzip -q "$HOME/eegmmidb.zip" -d "$HOME/eegmmidb_zip"
  S001="$(find "$HOME/eegmmidb_zip" -maxdepth 4 -type d -name S001 | head -1)"
  mv "$(dirname "$S001")"/* "$DANE"/
  rm -rf "$HOME/eegmmidb.zip" "$HOME/eegmmidb_zip"
fi

echo "== Budowanie bench_analysis"
cmake -S "$PROJEKT/backend" -B "$PROJEKT/backend/build" -DCMAKE_BUILD_TYPE=Release
cmake --build "$PROJEKT/backend/build" -j "$(nproc)" --target bench_analysis

WATKI="$(nproc)"
RDZENIE="$(lscpu -p=CORE,SOCKET | grep -v '^#' | sort -u | wc -l)"
WARIANTY=""
N=1
while [ "$N" -le "$WATKI" ]; do
  WARIANTY="$WARIANTY,$N"
  N=$((N * 2))
done
case ",$WARIANTY," in *",$RDZENIE,"*) ;; *) WARIANTY="$WARIANTY,$RDZENIE" ;; esac
case ",$WARIANTY," in *",$WATKI,"*) ;; *) WARIANTY="$WARIANTY,$WATKI" ;; esac
WARIANTY="${WARIANTY#,}"

mkdir -p "$WYNIKI"
lscpu > "$WYNIKI/lscpu.txt"
echo "wątki logiczne: $WATKI, rdzenie fizyczne: $RDZENIE, warianty: $WARIANTY" | tee "$WYNIKI/info.txt"

for ELEKTRODY in motor all; do
  echo "== Benchmark: elektrody $ELEKTRODY, badani $BADANI, $PRZEBIEGI przebiegów"
  mkdir -p "$WYNIKI/$ELEKTRODY"
  cd "$WYNIKI/$ELEKTRODY"
  "$PROJEKT/backend/build/bench_analysis" "$DANE" "$BADANI" wyobrazenie_lp "$ELEKTRODY" "$PRZEBIEGI" "$WARIANTY" \
    | tee wynik.txt
done

echo "== Gotowe. Wyniki w $WYNIKI"
