#!/bin/zsh
#
# Sklada aplikacje "Straznik Tajemnic AI.app" (lekki launcher, wersja PUBLICZNA)
# i instaluje do ~/Applications + fizyczna kopia na biurku. Uruchom po kazdej zmianie kodu
# ktora ma trafic do wersji "Graj".
#
# Uzycie: bash desktop/build-app.sh [--rebuild] [--output KATALOG] [--no-desktop-copy]
#   --rebuild  wymusza ponowny `npm run build` nawet gdy .next istnieje.

set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"          # korzen repo (worktree publiczny)
DESKTOP_DIR="$APP_DIR/desktop"
APP_NAME="Straznik Tajemnic AI"
APPS_DIR="$HOME/Applications"
OUTPUT_DIR="$APPS_DIR"
COPY_TO_DESKTOP=1
REBUILD=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --rebuild) REBUILD=1 ;;
    --output)
      shift
      [ "$#" -gt 0 ] || { echo "Brak katalogu po --output" >&2; exit 2; }
      OUTPUT_DIR="$1"
      ;;
    --no-desktop-copy) COPY_TO_DESKTOP=0 ;;
    *) echo "Nieznany argument: $1" >&2; exit 2 ;;
  esac
  shift
done
APP_BUNDLE="$OUTPUT_DIR/$APP_NAME.app"
DESK_APP="$HOME/Desktop/$APP_NAME.app"

# Wykryj katalog node (zaszyty w launcherze, bo .app nie dziedziczy PATH).
NODE_BIN_DIR="$(dirname "$(command -v node)")"

GAME_DIR="$APP_DIR"
if [ -f "$APP_DIR/_tester/_base/.silnik/package.json" ]; then
  GAME_DIR="$APP_DIR/_tester/_base/.silnik"
fi

cd "$GAME_DIR"
APP_VERSION="$(node -p "require('./package.json').version")"
COMMIT_SHA="${GITHUB_SHA:-$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo "")}"
SHORT_COMMIT="$(printf '%s' "$COMMIT_SHA" | cut -c1-7)"
BUILT_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

echo "[0/5] Cold-Start Smoke Gate (Bramka Pierwszych 10 Sekund)..."
npm test -- src/tests/smoke/cold-start-state.test.ts --silent

echo "[1/5] Production build..."
if [ "$REBUILD" = "1" ]; then
  echo "  [rebuild] Czyszczenie profilu Chrome i danych sesji gracza..."
  bash "$DESKTOP_DIR/cold-start.sh" || true
fi

if [ "$REBUILD" = "1" ] || [ ! -f .next/BUILD_ID ]; then
  npm run build
else
  echo "  build istnieje (.next/BUILD_ID) - pomijam. Wymus: bash desktop/build-app.sh --rebuild"
fi

node -e '
const fs = require("fs");
const info = {
  version: process.argv[2],
  commitSha: process.argv[3],
  shortCommit: process.argv[4],
  builtAt: process.argv[5],
};
fs.writeFileSync(process.argv[1], JSON.stringify(info, null, 2) + "\n");
' "$GAME_DIR/build-info.json" "$APP_VERSION" "$COMMIT_SHA" "$SHORT_COMMIT" "$BUILT_AT"

echo "[2/5] Ikona..."
bash "$DESKTOP_DIR/make-icon.sh" "$DESKTOP_DIR" || echo "  ikona pominieta - .app dostanie domyslna"

echo "[3/5] Skladanie $APP_NAME.app ..."
mkdir -p "$OUTPUT_DIR"
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources"

# Samowystarczalny runtime: desktop nie może czytać danych z worktree po przeniesieniu.
PACKAGE_RUNTIME="$APP_BUNDLE/Contents/Resources/runtime"
mkdir -p "$PACKAGE_RUNTIME"
rsync -a --delete \
  --exclude '.desktop' \
  --exclude '.next/cache' \
  --exclude 'data/saves' \
  --exclude 'data/sessions' \
  --exclude 'data/results' \
  --exclude 'data/usage' \
  --exclude 'data/pricing' \
  --exclude 'data/rag/rules*' \
  --exclude 'data/rag/rules-profile.json' \
  --exclude 'data/rag/capabilities.json' \
  --exclude 'data/rag/campaigns__*' \
  "$GAME_DIR/" "$PACKAGE_RUNTIME/"
rsync -a --delete "$DESKTOP_DIR/" "$PACKAGE_RUNTIME/desktop/"
cp "$GAME_DIR/build-info.json" "$PACKAGE_RUNTIME/build-info.json"

cat >"$APP_BUNDLE/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Strażnik Tajemnic AI</string>
  <key>CFBundleDisplayName</key><string>Strażnik Tajemnic AI</string>
  <key>CFBundleExecutable</key><string>launcher</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundleIdentifier</key><string>com.aios.straznik-tajemnic-ai</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$APP_VERSION</string>
  <key>CFBundleVersion</key><string>$APP_VERSION</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# launcher z dynamicznym wykrywaniem lokalizacji i zaszytym katalogiem node
sed -e "s|__NODE_BIN_DIR__|$NODE_BIN_DIR|g" \
    "$DESKTOP_DIR/launcher.sh" >"$APP_BUNDLE/Contents/MacOS/launcher"
chmod +x "$APP_BUNDLE/Contents/MacOS/launcher"

if [ -f "$DESKTOP_DIR/icon.icns" ]; then
  cp "$DESKTOP_DIR/icon.icns" "$APP_BUNDLE/Contents/Resources/icon.icns"
fi

# Odswiez cache ikon Findera dla tego bundla
touch "$APP_BUNDLE"

echo "[4/5] Kopia aplikacji na biurku..."
if [ "$COPY_TO_DESKTOP" = "1" ]; then
  rm -rf "$DESK_APP"
  ditto "$APP_BUNDLE" "$DESK_APP"
else
  echo "  pominieta (--no-desktop-copy)"
fi

echo "[5/5] Gotowe."
echo ""
echo "  Aplikacja : $APP_BUNDLE"
if [ "$COPY_TO_DESKTOP" = "1" ]; then echo "  Na biurku : $DESK_APP"; fi
echo "  Wersja    : $APP_VERSION ($SHORT_COMMIT)"
echo "  Node      : $NODE_BIN_DIR"
echo ""
echo "  Uruchom: dwuklik ikony na biurku  albo  open \"$APP_BUNDLE\""
echo "  Logi   : ~/Library/Logs/straznik-tajemnic-ai.log"
echo "  (Do grania potrzebny wazny GEMINI_API_KEY w .env.local)"
