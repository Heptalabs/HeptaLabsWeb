#!/usr/bin/env bash
set -euo pipefail

# Upload a built APK to the download server path via jump server.
#
# Usage:
#   bash scripts/imwallet-cd/deploy-apk-via-jump.sh /path/to/app-release.apk
#
# Required env:
# - IMWALLET_JUMP_HOST
# - IMWALLET_APP_HOST
# - SSH_KEY_PATH
#
# Optional env:
# - IMWALLET_JUMP_USER (default: vm)
# - IMWALLET_JUMP_PORT (default: 2222)
# - IMWALLET_APP_USER (default: vm)
# - IMWALLET_APP_PORT (default: 22)
# - IMWALLET_DOWNLOAD_DOMAIN (default: download.imwallet.app)
# - IMWALLET_DOWNLOAD_ROOT (default: /var/www/download.imwallet.app)
# - IMWALLET_APK_FILENAME (default: imwallet-latest.apk)
# - IMWALLET_APP_CONFIG_FILE (default: <repo>/imwallet-app/app.json)
# - IMWALLET_APP_NAME (fallback when app.json parse is unavailable)
# - IMWALLET_APP_VERSION (fallback when app.json parse is unavailable)
# - IMWALLET_APP_LABEL (final button label override; default: "<appName> <version>")
# - APK_SOURCE_PATH (fallback when argv is omitted)

IMWALLET_JUMP_USER="${IMWALLET_JUMP_USER:-vm}"
IMWALLET_JUMP_PORT="${IMWALLET_JUMP_PORT:-2222}"
IMWALLET_APP_USER="${IMWALLET_APP_USER:-vm}"
IMWALLET_APP_PORT="${IMWALLET_APP_PORT:-22}"
IMWALLET_DOWNLOAD_DOMAIN="${IMWALLET_DOWNLOAD_DOMAIN:-download.imwallet.app}"
IMWALLET_DOWNLOAD_ROOT="${IMWALLET_DOWNLOAD_ROOT:-/var/www/download.imwallet.app}"
IMWALLET_APK_FILENAME="${IMWALLET_APK_FILENAME:-imwallet-latest.apk}"
APK_SOURCE_PATH="${1:-${APK_SOURCE_PATH:-}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
IMWALLET_APP_CONFIG_FILE="${IMWALLET_APP_CONFIG_FILE:-$REPO_ROOT/imwallet-app/app.json}"
IMWALLET_APP_NAME="${IMWALLET_APP_NAME:-}"
IMWALLET_APP_VERSION="${IMWALLET_APP_VERSION:-}"
IMWALLET_APP_LABEL="${IMWALLET_APP_LABEL:-}"
IMWALLET_APK_URL_VERSION="${IMWALLET_APK_URL_VERSION:-$(date -u +%Y%m%d%H%M%S)}"

require_env() {
  local key="$1"
  if [[ -z "${!key:-}" ]]; then
    echo "[ERROR] Missing required env: ${key}" >&2
    exit 1
  fi
}

if [[ -z "$APK_SOURCE_PATH" ]]; then
  echo "[ERROR] APK path is required." >&2
  echo "Usage: bash scripts/imwallet-cd/deploy-apk-via-jump.sh /path/to/app-release.apk" >&2
  exit 1
fi

if [[ ! -f "$APK_SOURCE_PATH" ]]; then
  echo "[ERROR] APK not found: $APK_SOURCE_PATH" >&2
  exit 1
fi

require_env "IMWALLET_JUMP_HOST"
require_env "IMWALLET_APP_HOST"
require_env "SSH_KEY_PATH"

if [[ ! -f "$SSH_KEY_PATH" ]]; then
  echo "[ERROR] SSH key file not found: $SSH_KEY_PATH" >&2
  exit 1
fi

if command -v node >/dev/null 2>&1 && [[ -f "$IMWALLET_APP_CONFIG_FILE" ]]; then
  parsed_app_meta="$(node -e 'const fs=require("fs"); const p=process.argv[1]; const raw=JSON.parse(fs.readFileSync(p, "utf8")); const expo=raw.expo||{}; const name=(expo.name||"").toString(); const version=(expo.version||"").toString(); process.stdout.write(`${name}\t${version}`);' "$IMWALLET_APP_CONFIG_FILE" 2>/dev/null || true)"
  if [[ -n "$parsed_app_meta" ]]; then
    IFS=$'\t' read -r parsed_app_name parsed_app_version <<<"$parsed_app_meta"
    if [[ -z "$IMWALLET_APP_NAME" ]]; then
      IMWALLET_APP_NAME="$parsed_app_name"
    fi
    if [[ -z "$IMWALLET_APP_VERSION" ]]; then
      IMWALLET_APP_VERSION="$parsed_app_version"
    fi
  fi
fi

if [[ -z "$IMWALLET_APP_NAME" ]]; then
  IMWALLET_APP_NAME="IMWallet"
fi

if [[ -z "$IMWALLET_APP_LABEL" ]]; then
  if [[ -n "$IMWALLET_APP_VERSION" ]]; then
    if [[ "$IMWALLET_APP_NAME" == *"$IMWALLET_APP_VERSION"* ]]; then
      IMWALLET_APP_LABEL="$IMWALLET_APP_NAME"
    else
      IMWALLET_APP_LABEL="${IMWALLET_APP_NAME} ${IMWALLET_APP_VERSION}"
    fi
  else
    IMWALLET_APP_LABEL="$IMWALLET_APP_NAME"
  fi
fi

IMWALLET_APK_PUBLIC_FILENAME="${IMWALLET_APP_LABEL}.apk"
IMWALLET_APK_PUBLIC_FILENAME="${IMWALLET_APK_PUBLIC_FILENAME//$'\n'/ }"
IMWALLET_APK_PUBLIC_FILENAME="${IMWALLET_APK_PUBLIC_FILENAME//\//-}"

if command -v node >/dev/null 2>&1; then
  IMWALLET_APK_PUBLIC_URL_PATH="/downloads/$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1] || ""));' "$IMWALLET_APK_PUBLIC_FILENAME")"
else
  escaped_public_name="${IMWALLET_APK_PUBLIC_FILENAME// /%20}"
  IMWALLET_APK_PUBLIC_URL_PATH="/downloads/${escaped_public_name}"
fi
IMWALLET_APK_PUBLIC_URL_PATH="${IMWALLET_APK_PUBLIC_URL_PATH}?v=${IMWALLET_APK_URL_VERSION}"

LOCAL_META_FILE="$(mktemp "/tmp/imwallet-latest-meta.XXXXXX.json")"
cleanup_local_meta() {
  rm -f "$LOCAL_META_FILE"
}
trap cleanup_local_meta EXIT

if command -v node >/dev/null 2>&1; then
  node -e 'const [appName, version, label, apkPath] = process.argv.slice(1); const payload = { appName, version, label, apkPath, updatedAt: new Date().toISOString() }; process.stdout.write(JSON.stringify(payload, null, 2) + "\n");' \
    "$IMWALLET_APP_NAME" "$IMWALLET_APP_VERSION" "$IMWALLET_APP_LABEL" "$IMWALLET_APK_PUBLIC_URL_PATH" >"$LOCAL_META_FILE"
else
  cat >"$LOCAL_META_FILE" <<EOF
{
  "appName": "${IMWALLET_APP_NAME}",
  "version": "${IMWALLET_APP_VERSION}",
  "label": "${IMWALLET_APP_LABEL}",
  "apkPath": "${IMWALLET_APK_PUBLIC_URL_PATH}",
  "updatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
fi

chmod 600 "$SSH_KEY_PATH"

PROXY_COMMAND="ssh -i $SSH_KEY_PATH -p $IMWALLET_JUMP_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${IMWALLET_JUMP_USER}@${IMWALLET_JUMP_HOST} -W %h:%p"
APP_COMMON_OPTS=(
  -i "$SSH_KEY_PATH"
  -o "ProxyCommand=${PROXY_COMMAND}"
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
)
APP_SSH_OPTS=(
  "${APP_COMMON_OPTS[@]}"
  -p "$IMWALLET_APP_PORT"
)
APP_SCP_OPTS=(
  "${APP_COMMON_OPTS[@]}"
  -P "$IMWALLET_APP_PORT"
)

REMOTE_TMP_APK="/tmp/${IMWALLET_APK_FILENAME}"
REMOTE_TMP_META="/tmp/imwallet-latest-meta.json"
TARGET_DIR="${IMWALLET_DOWNLOAD_ROOT}/downloads"
TARGET_APK="${TARGET_DIR}/${IMWALLET_APK_FILENAME}"
TARGET_PUBLIC_APK="${TARGET_DIR}/${IMWALLET_APK_PUBLIC_FILENAME}"
TARGET_META="${TARGET_DIR}/latest.json"

echo "[INFO] Uploading APK + metadata to app server (${IMWALLET_APP_HOST}) via jump..."
scp "${APP_SCP_OPTS[@]}" \
  "$APK_SOURCE_PATH" \
  "${IMWALLET_APP_USER}@${IMWALLET_APP_HOST}:${REMOTE_TMP_APK}"
scp "${APP_SCP_OPTS[@]}" \
  "$LOCAL_META_FILE" \
  "${IMWALLET_APP_USER}@${IMWALLET_APP_HOST}:${REMOTE_TMP_META}"

echo "[INFO] Publishing APK to ${TARGET_APK} ..."
ssh "${APP_SSH_OPTS[@]}" "${IMWALLET_APP_USER}@${IMWALLET_APP_HOST}" \
  "bash -s -- '${IMWALLET_DOWNLOAD_DOMAIN}' '${REMOTE_TMP_APK}' '${REMOTE_TMP_META}' '${TARGET_DIR}' '${TARGET_APK}' '${TARGET_PUBLIC_APK}' '${TARGET_META}' '${IMWALLET_APK_FILENAME}'" <<'APP_EOF'
set -euo pipefail
DOWNLOAD_DOMAIN="$1"
REMOTE_TMP_APK="$2"
REMOTE_TMP_META="$3"
TARGET_DIR="$4"
TARGET_APK="$5"
TARGET_PUBLIC_APK="$6"
TARGET_META="$7"
APK_FILENAME="$8"

if [[ ! -f "${REMOTE_TMP_APK}" ]]; then
  echo "[ERROR] Uploaded tmp APK not found: ${REMOTE_TMP_APK}" >&2
  exit 1
fi

if [[ ! -f "${REMOTE_TMP_META}" ]]; then
  echo "[ERROR] Uploaded tmp metadata not found: ${REMOTE_TMP_META}" >&2
  exit 1
fi

sudo mkdir -p "${TARGET_DIR}"
sudo mv "${REMOTE_TMP_APK}" "${TARGET_APK}"
sudo cp "${TARGET_APK}" "${TARGET_PUBLIC_APK}"
sudo mv "${REMOTE_TMP_META}" "${TARGET_META}"
sudo chown www-data:www-data "${TARGET_APK}"
sudo chown www-data:www-data "${TARGET_PUBLIC_APK}"
sudo chown www-data:www-data "${TARGET_META}"
sudo chmod 644 "${TARGET_APK}"
sudo chmod 644 "${TARGET_PUBLIC_APK}"
sudo chmod 644 "${TARGET_META}"

curl -fsSI -H "Host: ${DOWNLOAD_DOMAIN}" "http://127.0.0.1/downloads/${APK_FILENAME}" >/dev/null
curl -fsS -H "Host: ${DOWNLOAD_DOMAIN}" "http://127.0.0.1/downloads/latest.json" >/dev/null
APP_EOF

echo "[INFO] APK publish completed: /downloads/${IMWALLET_APK_FILENAME}"
echo "[INFO] APK public file: /downloads/${IMWALLET_APK_PUBLIC_FILENAME}"
echo "[INFO] Metadata updated: /downloads/latest.json (${IMWALLET_APP_LABEL})"
