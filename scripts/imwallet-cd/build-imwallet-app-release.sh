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
    --exclude='android/.gradle' \
    --exclude='test-results' \
    --exclude='.DS_Store' \
    "${LOCAL_APP_DIR}/" "${REMOTE_HOST}:${REMOTE_ROOT}/"
fi

ssh "$REMOTE_HOST" REMOTE_ROOT="$REMOTE_ROOT" REMOTE_WEB_ROOT="$REMOTE_WEB_ROOT" BUILD_DATE="$BUILD_DATE" 'bash -s' <<'EOS'
set -euo pipefail

VERSION_FILE="$REMOTE_ROOT/android/version-code.txt"
GRADLE_FILE="$REMOTE_ROOT/android/app/build.gradle"
APK_SOURCE="$REMOTE_ROOT/android/app/build/outputs/apk/release/app-release.apk"

if [[ ! -f "$VERSION_FILE" ]]; then
  base_code="$(grep -Eo 'versionCode \(envVersionCode != null \? envVersionCode.toInteger\(\) : [0-9]+\)' "$GRADLE_FILE" | grep -Eo '[0-9]+' | tail -1 || true)"
  if [[ -z "$base_code" ]]; then
    base_code="$(grep -Eo 'versionCode [0-9]+' "$GRADLE_FILE" | awk '{print $2}' | tail -1 || echo 1)"
  fi
  printf '%s\n' "$base_code" | sudo tee "$VERSION_FILE" >/dev/null
fi

current_code="$(tr -dc '0-9' < "$VERSION_FILE")"
if [[ -z "$current_code" ]]; then
  current_code=1
fi

# Guard against accidental versionCode regression when older higher-numbered
# APKs already exist in the download directory.
max_existing_from_apk="$(ls -1 "$REMOTE_WEB_ROOT"/downloads/imwallet-release-"$BUILD_DATE"-*.apk 2>/dev/null \
  | sed -E "s#.*imwallet-release-${BUILD_DATE}-([0-9]+)\\.apk#\\1#" \
  | sort -n \
  | tail -1 || true)"
if [[ -n "$max_existing_from_apk" ]] && [[ "$max_existing_from_apk" -gt "$current_code" ]]; then
  current_code="$max_existing_from_apk"
fi

next_code=$((current_code + 1))
version_name="0.1.${next_code}"
printf '%s\n' "$next_code" | sudo tee "$VERSION_FILE" >/dev/null

sudo docker run --rm \
  -e IMWALLET_VERSION_CODE="$next_code" \
  -e IMWALLET_VERSION_NAME="$version_name" \
  -v "$REMOTE_ROOT:/workspace" \
  -w /workspace \
  reactnativecommunity/react-native-android:latest \
  bash -lc "npm ci && cd android && ./gradlew --no-daemon assembleRelease"

if [[ ! -f "$APK_SOURCE" ]]; then
  echo "[ERROR] APK not found: $APK_SOURCE" >&2
  exit 1
fi

VERSIONED_APK="$REMOTE_WEB_ROOT/downloads/imwallet-release-${BUILD_DATE}-${next_code}.apk"
LATEST_APK="$REMOTE_WEB_ROOT/downloads/imwallet-latest.apk"
STABLE_APK="$REMOTE_WEB_ROOT/downloads/imwallet-release.apk"

sudo cp "$APK_SOURCE" "$VERSIONED_APK"
sudo cp "$APK_SOURCE" "$LATEST_APK"
sudo cp "$APK_SOURCE" "$STABLE_APK"
sudo chown www-data:www-data "$VERSIONED_APK" "$LATEST_APK" "$STABLE_APK"
sudo chmod 644 "$VERSIONED_APK" "$LATEST_APK" "$STABLE_APK"

echo "[OK] versionCode=$next_code versionName=$version_name"
echo "[OK] versioned_apk=$VERSIONED_APK"
echo "[OK] latest_apk=$LATEST_APK"
EOS
