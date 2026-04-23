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
# - APK_SOURCE_PATH (fallback when argv is omitted)

IMWALLET_JUMP_USER="${IMWALLET_JUMP_USER:-vm}"
IMWALLET_JUMP_PORT="${IMWALLET_JUMP_PORT:-2222}"
IMWALLET_APP_USER="${IMWALLET_APP_USER:-vm}"
IMWALLET_APP_PORT="${IMWALLET_APP_PORT:-22}"
IMWALLET_DOWNLOAD_DOMAIN="${IMWALLET_DOWNLOAD_DOMAIN:-download.imwallet.app}"
IMWALLET_DOWNLOAD_ROOT="${IMWALLET_DOWNLOAD_ROOT:-/var/www/download.imwallet.app}"
IMWALLET_APK_FILENAME="${IMWALLET_APK_FILENAME:-imwallet-latest.apk}"
APK_SOURCE_PATH="${1:-${APK_SOURCE_PATH:-}}"

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
TARGET_DIR="${IMWALLET_DOWNLOAD_ROOT}/downloads"
TARGET_APK="${TARGET_DIR}/${IMWALLET_APK_FILENAME}"

echo "[INFO] Uploading APK to app server (${IMWALLET_APP_HOST}) via jump..."
scp "${APP_SCP_OPTS[@]}" "$APK_SOURCE_PATH" "${IMWALLET_APP_USER}@${IMWALLET_APP_HOST}:${REMOTE_TMP_APK}"

echo "[INFO] Publishing APK to ${TARGET_APK} ..."
ssh "${APP_SSH_OPTS[@]}" "${IMWALLET_APP_USER}@${IMWALLET_APP_HOST}" \
  "bash -s -- '${IMWALLET_DOWNLOAD_DOMAIN}' '${REMOTE_TMP_APK}' '${TARGET_DIR}' '${TARGET_APK}' '${IMWALLET_APK_FILENAME}'" <<'APP_EOF'
set -euo pipefail
DOWNLOAD_DOMAIN="$1"
REMOTE_TMP_APK="$2"
TARGET_DIR="$3"
TARGET_APK="$4"
APK_FILENAME="$5"

if [[ ! -f "${REMOTE_TMP_APK}" ]]; then
  echo "[ERROR] Uploaded tmp APK not found: ${REMOTE_TMP_APK}" >&2
  exit 1
fi

sudo mkdir -p "${TARGET_DIR}"
sudo mv "${REMOTE_TMP_APK}" "${TARGET_APK}"
sudo chown www-data:www-data "${TARGET_APK}"
sudo chmod 644 "${TARGET_APK}"

curl -fsSI -H "Host: ${DOWNLOAD_DOMAIN}" "http://127.0.0.1/downloads/${APK_FILENAME}" >/dev/null
APP_EOF

echo "[INFO] APK publish completed: /downloads/${IMWALLET_APK_FILENAME}"
