#!/bin/zsh
#
# Strażnik Tajemnic AI (wersja publiczna) - launcher aplikacji na biurku.
#
# Zadanie:
#   1. Zapewnić, że lokalny serwer gry (next start) działa na porcie 4050.
#   2. Otworzyć okno gry w trybie app (Chrome --app = bez paska adresu, wyglada natywnie).
#   3. Serwer "na zadanie": jesli to MY go odpalilismy, ubic go gdy zamkniesz okno gry.
#
# Placeholdery __APP_DIR__ i __NODE_BIN_DIR__ podmienia desktop/build-app.sh przy skladaniu .app.
# Skrypt dziala tez uruchomiony bezposrednio ze zrodla (fallbacki ponizej).

set -u
setopt NULL_GLOB   # niepasujacy glob (np. brak ~/.nvm) -> pusty zamiast bledu; bez tego zsh przerywa skrypt

APP_DIR="__APP_DIR__"
NODE_BIN_DIR="__NODE_BIN_DIR__"
PORT=4050
URL="http://localhost:${PORT}"

# --- Ustal APP_DIR ---
# Jeśli skrypt jest wewnątrz pakietu macOS (.app/Contents/MacOS/launcher),
# runtime leży zawsze w ../Resources/runtime względem launchera.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -d "$SCRIPT_DIR/../Resources/runtime" ]; then
  APP_DIR="$(cd "$SCRIPT_DIR/../Resources/runtime" && pwd)"
elif [ ! -f "$APP_DIR/package.json" ] && [ ! -f "$APP_DIR/_tester/_base/.silnik/package.json" ]; then
  APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

# Bundle moze zostac zlozony z katalogu glownego albo bezposrednio z silnika.
# Serwer, build i profil Chrome zawsze musza wskazywac na faktyczny runtime.
GAME_DIR="$APP_DIR"
if [ -f "$APP_DIR/_tester/_base/.silnik/package.json" ]; then
  GAME_DIR="$APP_DIR/_tester/_base/.silnik"
fi

# --- node/npm w PATH ---
# .app uruchamiany z Findera NIE dziedziczy shellowego PATH; trzeba wskazac node recznie.
# Detekcja po -x (istnienie node), nie po placeholderze - z tego samego powodu co wyzej.
if [ ! -x "$NODE_BIN_DIR/node" ]; then
  for d in /opt/homebrew/bin /usr/local/bin "$HOME/.nvm/versions/node"/*/bin "$HOME/.local/bin"; do
    if [ -x "$d/node" ]; then NODE_BIN_DIR="$d"; break; fi
  done
fi
export PATH="$NODE_BIN_DIR:/opt/homebrew/bin:/usr/local/bin:$PATH"

DATA_ROOT="${ZEW_DATA_DIR:-$HOME/Library/Application Support/ZewCthulhu}"
export ZEW_DATA_DIR="$DATA_ROOT"
export RAG_DATA_DIR="$DATA_ROOT/rag"
export ZEW_APP_BUNDLE="$(cd "$(dirname "$0")/../.." && pwd)"
export STRAZNIK_DESKTOP_UPDATE=1
export ZEW_UPDATE_MANIFEST_URL="${ZEW_UPDATE_MANIFEST_URL:-https://github.com/InduPhantom-hash/straznik-tajemnic/releases/latest/download/update-manifest.json}"
if [[ "$ZEW_APP_BUNDLE" == *.app ]]; then
  export ZEW_DESKTOP_SELF_UPDATE=1
else
  export ZEW_DESKTOP_SELF_UPDATE=0
fi

RUNTIME_DIR="$DATA_ROOT/desktop"
PROFILE_DIR="$RUNTIME_DIR/chrome-profile"
PID_FILE="$RUNTIME_DIR/server.pid"
COLD_START_FLAG="$RUNTIME_DIR/cold-start-requested"
LOG="${ZEW_LOG_FILE:-$HOME/Library/Logs/straznik-tajemnic-ai.log}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

mkdir -p "$RUNTIME_DIR" "$PROFILE_DIR" "$ZEW_DATA_DIR" "$RAG_DATA_DIR" "$DATA_ROOT/updates"

# Jednorazowa migracja danych z wcześniejszych bundli, które zapisywały do runtime/data.
MIGRATION_MARKER="$DATA_ROOT/.bundle-data-migrated-v1"
if [ ! -f "$MIGRATION_MARKER" ]; then
  for name in saves sessions results usage pricing gm-instructions journals memory; do
    if [ -d "$GAME_DIR/data/$name" ] && [ ! -e "$DATA_ROOT/$name" ]; then
      ditto "$GAME_DIR/data/$name" "$DATA_ROOT/$name"
    fi
  done
  if [ -d "$GAME_DIR/.desktop/chrome-profile" ] && [ ! -e "$PROFILE_DIR/Default" ]; then
    ditto "$GAME_DIR/.desktop/chrome-profile" "$PROFILE_DIR"
  fi
  touch "$MIGRATION_MARKER"
fi
cd "$GAME_DIR" || { echo "$(date) BLAD: brak katalogu $GAME_DIR" >>"$LOG"; exit 1; }
rm -f "$COLD_START_FLAG"

# Chrome nie ma pytać o zapisywanie haseł w profilu launchera.
CHROME_PREFS="$PROFILE_DIR/Default/Preferences"
node -e '
const fs = require("fs");
const path = process.argv[1];
let prefs = {};
try { prefs = JSON.parse(fs.readFileSync(path, "utf8")); } catch (_) {}
prefs.credentials_enable_service = false;
prefs.profile = { ...(prefs.profile || {}), password_manager_enabled: false };
fs.mkdirSync(require("path").dirname(path), { recursive: true });
fs.writeFileSync(path, JSON.stringify(prefs));
' "$CHROME_PREFS"

echo "=== $(date) launcher start (port $PORT) ===" >>"$LOG"

# --- 1. Zapewnij serwer ---
# Serwer uruchomiony starym launcherem nie ma flagi potrzebnej trasie API.
# Zastap go tutaj, zanim otworzymy okno gry.
if curl -sf "$URL" >/dev/null 2>&1 && ! curl -sf "$URL/api/desktop/cold-start" | grep -q '"available":true'; then
  echo "$(date) serwer bez mostu zimnego startu - zatrzymuje stary proces" >>"$LOG"
  lsof -ti :$PORT 2>/dev/null | xargs kill 2>/dev/null || true
  for _ in $(seq 1 20); do
    lsof -ti :$PORT >/dev/null 2>&1 || break
    sleep 0.25
  done
fi

# Jeśli serwer działa, upewnijmy się że służy aktualny kod (BUILD_ID z dysku)
if curl -sf "$URL" >/dev/null 2>&1; then
  if [ -f "$GAME_DIR/.next/BUILD_ID" ]; then
    DISK_BUILD_ID="$(cat "$GAME_DIR/.next/BUILD_ID")"
    # Next middleware can answer an unknown static URL with HTML and HTTP 200.
    # A status code alone therefore cannot prove that this is the on-disk build.
    if ! curl -fsS "$URL/_next/static/${DISK_BUILD_ID}/_buildManifest.js" 2>/dev/null | grep -q 'self.__BUILD_MANIFEST'; then
      echo "$(date) serwer ma przestarzaly BUILD_ID - zatrzymuje stary proces" >>"$LOG"
      lsof -ti :$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
      for _ in $(seq 1 20); do
        lsof -ti :$PORT >/dev/null 2>&1 || break
        sleep 0.25
      done
    fi
  fi
fi

SUPERVISOR_SCRIPT=""
if [ -f "$APP_DIR/desktop/supervisor.mjs" ]; then
  SUPERVISOR_SCRIPT="$APP_DIR/desktop/supervisor.mjs"
elif [ -f "$GAME_DIR/desktop/supervisor.mjs" ]; then
  SUPERVISOR_SCRIPT="$GAME_DIR/desktop/supervisor.mjs"
fi

if [ -n "$SUPERVISOR_SCRIPT" ]; then
  echo "$(date) przekazuje kontrole do desktop/supervisor.mjs" >>"$LOG"
  exec node "$SUPERVISOR_SCRIPT"
fi

STARTED_SERVER=0
if ! curl -sf "$URL" >/dev/null 2>&1; then
  echo "$(date) startuje serwer (next start)..." >>"$LOG"
  STRAZNIK_DESKTOP_COLD_START=1 STRAZNIK_DESKTOP_UPDATE=$STRAZNIK_DESKTOP_UPDATE ZEW_DESKTOP_SELF_UPDATE=$ZEW_DESKTOP_SELF_UPDATE ZEW_UPDATE_MANIFEST_URL="$ZEW_UPDATE_MANIFEST_URL" ZEW_APP_BUNDLE="$ZEW_APP_BUNDLE" ZEW_DATA_DIR="$ZEW_DATA_DIR" RAG_DATA_DIR="$RAG_DATA_DIR" ZEW_APP_PORT=$PORT PORT=$PORT nohup npm start >>"$LOG" 2>&1 &
  echo $! >"$PID_FILE"
  STARTED_SERVER=1
  # health-check ~30 s
  for _ in $(seq 1 100); do
    curl -sf "$URL" >/dev/null 2>&1 && break
    sleep 0.3
  done
else
  echo "$(date) serwer juz dziala - tylko otwieram okno" >>"$LOG"
fi

# --- 2. Otworz okno gry w trybie app ---
if [ -x "$CHROME" ]; then
  open -na "Google Chrome" --args \
    --app="$URL" \
    --start-fullscreen \
    --autoplay-policy=no-user-gesture-required \
    --user-data-dir="$PROFILE_DIR" \
    --no-first-run --no-default-browser-check >>"$LOG" 2>&1
else
  echo "$(date) brak Chrome - otwieram w domyslnej przegladarce" >>"$LOG"
  open "$URL"
fi

# --- 3. Obsluga zimnego startu + auto-shutdown ---
sleep 4
# Monitorujemy sygnal nawet gdy serwer istnial, bo poprzedni launcher mogl juz nie dzialac.
COLD_START_REQUESTED=0
while pgrep -f "user-data-dir=$PROFILE_DIR" >/dev/null 2>&1; do
  if [ -f "$COLD_START_FLAG" ]; then
    COLD_START_REQUESTED=1
    break
  fi
  sleep 0.5
done
if [ "$COLD_START_REQUESTED" = "1" ]; then
  rm -f "$COLD_START_FLAG"
  echo "$(date) UI zlecilo zimny start" >>"$LOG"
  exec env ZEW_APP_DIR="$GAME_DIR" ZEW_APP_PORT="$PORT" bash "$GAME_DIR/desktop/cold-start.sh" --play
fi

# Normalne zamkniecie ubija serwer tylko wtedy, gdy uruchomil go ten launcher.
if [ "$STARTED_SERVER" = "1" ]; then
  echo "$(date) okno zamkniete - zatrzymuje serwer" >>"$LOG"
  if [ -f "$PID_FILE" ]; then
    SRV_PID="$(cat "$PID_FILE")"
    pkill -P "$SRV_PID" 2>/dev/null
    kill "$SRV_PID" 2>/dev/null
    rm -f "$PID_FILE"
  fi
  # Dobij cokolwiek wciaz nasluchuje na porcie (next start forkuje proces dziecko).
  lsof -ti :$PORT 2>/dev/null | xargs kill 2>/dev/null
  echo "=== $(date) serwer zatrzymany ===" >>"$LOG"
fi
