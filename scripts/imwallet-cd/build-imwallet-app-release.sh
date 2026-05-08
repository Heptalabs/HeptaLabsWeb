#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

REMOTE_HOST="${IMWALLET_APP_HOST:-imwallet-app}"
REMOTE_ROOT="${IMWALLET_REMOTE_ROOT:-/opt/imwallet/build/imwallet-app}"
REMOTE_WEB_ROOT="${IMWALLET_DOWNLOAD_ROOT:-/var/www/download.imwallet.app}"
BUILD_DATE="${IMWALLET_BUILD_DATE:-$(date +%Y%m%d)}"
LOCAL_APP_DIR="${IMWALLET_LOCAL_APP_DIR:-$REPO_ROOT/imwallet-app}"
SYNC_LOCAL_APP="${IMWALLET_SYNC_LOCAL_APP:-1}"

if [[ "$SYNC_LOCAL_APP" != "0" ]]; then
  if [[ ! -d "$LOCAL_APP_DIR" ]]; then
    echo "[ERROR] Local app directory not found: $LOCAL_APP_DIR" >&2
    exit 1
  fi

  echo "[INFO] Syncing local app source to ${REMOTE_HOST}:${REMOTE_ROOT} ..."
  rsync -az \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.expo' \
    --exclude='dist-web' \
    --exclude='android/build' \
    --exclude='android/app/build' \
    --exclude='android/app/.cxx' \
    --exclude='android/.gradle' \
    --exclude='test-results' \
    --exclude='.DS_Store' \
    "${LOCAL_APP_DIR}/" "${REMOTE_HOST}:${REMOTE_ROOT}/"
fi

ssh "$REMOTE_HOST" REMOTE_ROOT="$REMOTE_ROOT" REMOTE_WEB_ROOT="$REMOTE_WEB_ROOT" BUILD_DATE="$BUILD_DATE" 'bash -s' <<'EOS'
set -euo pipefail

APK_SOURCE="$REMOTE_ROOT/android/app/build/outputs/apk/release/app-release.apk"
APP_JSON="$REMOTE_ROOT/app.json"
GRADLE_FILE="$REMOTE_ROOT/android/app/build.gradle"
version_name=""
version_code=""

if [[ -f "$APP_JSON" ]]; then
  parsed="$(node -e '
const fs = require("fs");
const path = process.argv[1];
try {
  const raw = JSON.parse(fs.readFileSync(path, "utf8"));
  const version = String(raw?.expo?.version ?? "").trim();
  const code = String(raw?.expo?.android?.versionCode ?? "").trim();
  process.stdout.write(`${version}\t${code}`);
} catch {
  process.stdout.write("\t");
}
' "$APP_JSON" 2>/dev/null || true)"
  if [[ -n "$parsed" ]]; then
    IFS=$'\t' read -r version_name version_code <<<"$parsed"
  fi
fi

if [[ -z "$version_name" ]]; then
  version_name="$(grep -Eo 'versionName "[^"]+"' "$GRADLE_FILE" | sed -E 's/versionName "([^"]+)"/\1/' | tail -1 || true)"
fi

if [[ -z "$version_code" ]]; then
  version_code="$(grep -Eo 'versionCode [0-9]+' "$GRADLE_FILE" | awk '{print $2}' | tail -1 || true)"
fi

if [[ -z "$version_name" ]]; then
  echo "[ERROR] Unable to resolve versionName from app.json/build.gradle" >&2
  exit 1
fi

if [[ -z "$version_code" ]]; then
  echo "[ERROR] Unable to resolve versionCode from app.json/build.gradle" >&2
  exit 1
fi

sudo docker run --rm \
  -v "$REMOTE_ROOT:/workspace" \
  -w /workspace \
  reactnativecommunity/react-native-android:latest \
  bash -lc "npm ci && cd android && ./gradlew --no-daemon assembleRelease"

if [[ ! -f "$APK_SOURCE" ]]; then
  echo "[ERROR] APK not found: $APK_SOURCE" >&2
  exit 1
fi

VERSIONED_APK="$REMOTE_WEB_ROOT/downloads/imwallet-release-${BUILD_DATE}-${version_code}.apk"
LATEST_APK="$REMOTE_WEB_ROOT/downloads/imwallet-latest.apk"
STABLE_APK="$REMOTE_WEB_ROOT/downloads/imwallet-release.apk"

sudo cp "$APK_SOURCE" "$VERSIONED_APK"
sudo cp "$APK_SOURCE" "$LATEST_APK"
sudo cp "$APK_SOURCE" "$STABLE_APK"
sudo chown www-data:www-data "$VERSIONED_APK" "$LATEST_APK" "$STABLE_APK"
sudo chmod 644 "$VERSIONED_APK" "$LATEST_APK" "$STABLE_APK"

echo "[OK] versionCode=$version_code versionName=$version_name"
echo "[OK] versioned_apk=$VERSIONED_APK"
echo "[OK] latest_apk=$LATEST_APK"
EOS
