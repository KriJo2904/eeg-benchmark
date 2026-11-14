# Analiza EEG (EEGMMIDB)

Aplikacja do analizy ERD w sygnałach EEG ze zbioru PhysioNet EEGMMIDB i do pomiaru, ile szybciej ta analiza
liczy się na wielu wątkach.

| Część | Technologia | Port | Gdzie działa |
|---|---|---|---|
| backend | C++20, cpp-httplib | 8080 | maszyna z backendem, natywnie |
| projects-api | Node, Express, Mongo | 3000 | maszyna z aplikacją, Docker |
| frontend | React, Vite, nginx | 5173 | maszyna z aplikacją, Docker |

## Dwie maszyny

```
przeglądarka ──> frontend (nginx) ──/projects-api──> projects-api ──> Mongo     maszyna z aplikacją
     │
     └──/api (adres z panelu Backend)──> backend C++ ──> projects-api            maszyna z backendem
```

Backend pobiera z projects-api projekt (pipeline, selekcję) i zapisuje tam wynik analizy, więc musi widzieć
port 3000 maszyny z aplikacją. Przeglądarka łączy się z backendem bezpośrednio, pod adresem wpisanym na froncie.

### Maszyna z aplikacją (Docker)

Potrzebne: Docker z Compose (v2).

```bash
./start-aplikacja.sh
```

Uruchamia Mongo, projects-api i frontend. Skrypt wypisuje adres frontendu i komendę dla drugiej maszyny.

Zatrzymanie: `docker compose down`. Logi: `docker compose logs -f`.

### Maszyna z backendem (natywnie)

Potrzebne: kompilator C++20 (GCC 11+ albo Clang 14+), CMake 3.24+, git, curl, unzip i tar. Przy pierwszym
budowaniu CMake pobiera z GitHuba nlohmann/json, cpp-httplib i pocketfft, więc potrzebny jest internet.
Na Ubuntu 24.04 (starsze mają za stary CMake): `sudo apt install build-essential cmake git curl unzip`.

```bash
./start-backend.sh 192.168.1.10
```

Argument to adres maszyny z aplikacją (port 3000 dopisuje się sam). Skrypt buduje `eeg_server`, sprawdza,
czy projects-api odpowiada, i wypisuje adres backendu do wpisania na froncie. Bez argumentu backend łączy się
z projects-api na tej samej maszynie.

Zmienne: `EEG_DATA_DIR` (katalog ze zbiorami danych, domyślnie `backend/dane`), `PORT` (domyślnie 8080).
Zapora musi przepuszczać port 8080.

### Połączenie na froncie

Domyślnie front nie jest połączony z żadnym backendem. Adres (np. `192.168.1.20`, port 8080 dopisuje się sam)
wpisuje się w panelu **Backend** w prawym górnym rogu. Adres trzyma się do zamknięcia karty, a udane
połączenia trafiają na listę ostatnich. Bez połączenia zakładki projektu są zablokowane.

Kropka przy przycisku: zielona, gdy backend odpowiada i widzi projects-api, pomarańczowa, gdy nie widzi
projects-api, czerwona, gdy backend nie odpowiada. Stan odświeża się co 5 s.

Backend udostępnia `GET /api/ping` (czas odpowiedzi) i `GET /api/status` (nazwa maszyny, wątki, katalog danych,
połączenie z projects-api).

### Dane

Każdy podfolder `EEG_DATA_DIR` to osobny zbiór w układzie EEGMMIDB (foldery `S001`, `S002`... z plikami `.edf`).
Projekt ma przypisany jeden zbiór, wybierany w zakładce **Dane**:

- **Pobierz z linku**: backend pobiera plik przez `curl` w tle i zapisuje go w katalogu danych. Archiwa
  `.zip` i `.tar(.gz/.bz2/.xz)` rozpakowuje, a jeśli archiwum ma jeden folder w środku, wchodzi do niego.
  Inny plik zapisuje w nowym folderze bez zmian.
- **Dane na backendzie**: file manager ([@cubone/react-file-manager](https://github.com/Saifullah-dev/react-file-manager),
  MIT) z podglądem katalogu danych. Można tworzyć foldery, zmieniać nazwy i usuwać. **Użyj w projekcie**
  przypisuje zaznaczony (albo otwarty) folder do projektu, jeśli są w nim pliki EDF.

Pełny EEGMMIDB (ok. 2 GB): `https://physionet.org/content/eegmmidb/get-zip/1.0.0/`.
Po pobraniu wskaż folder, w którym leżą `S001`...`S109`.

API backendu: `GET /api/files`, `POST /api/files/folder`, `POST /api/files/rename`, `DELETE /api/files?path=`,
`GET /api/datasets/check?path=`, `GET|POST /api/downloads`, `DELETE /api/downloads/:id`.

## Jedna maszyna (dev)

```bash
./dev.sh
```

Backend natywnie na :8080, w Dockerze Vite z HMR (`http://localhost:5173`), Mongo i projects-api.
W panelu Backend wpisz `localhost`. Ctrl+C zatrzymuje wszystko.

## Benchmark z konsoli

```bash
backend/build/bench_analysis backend/eegmmidb S001-S030 wyobrazenie_lp motor 3
```

Pisze `bench_analysis.csv` (czas, przyspieszenie, efektywność) i `erd_srednia.csv`.
`scripts/bench_linux.sh` instaluje zależności, pobiera dane i uruchamia pełny pomiar na Linuksie.
