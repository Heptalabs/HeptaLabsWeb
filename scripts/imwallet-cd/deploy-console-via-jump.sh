#!/usr/bin/env bash
set -euo pipefail

# Deploy console dist bundle to app server through jump server.
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
# - IMWALLET_CONSOLE_TARGET_PATH (default: /opt/imwallet/console-dist)
# - IMWALLET_CONSOLE_RESTART_SERVICE (optional; e.g. nginx or imwallet-console)

IMWALLET_JUMP_USER="${IMWALLET_JUMP_USER:-vm}"
IMWALLET_JUMP_PORT="${IMWALLET_JUMP_PORT:-2222}"
IMWALLET_APP_USER="${IMWALLET_APP_USER:-vm}"
IMWALLET_CONSOLE_TARGET_PATH="${IMWALLET_CONSOLE_TARGET_PATH:-/opt/imwallet/console-dist}"
IMWALLET_CONSOLE_RESTART_SERVICE="${IMWALLET_CONSOLE_RESTART_SERVICE:-}"

require_env() {
  local key="$1"
  if [[ -z "${!key:-}" ]]; then
    echo "[ERROR] Missing required env: ${key}" >&2
    exit 1
  fi
}

require_env "IMWALLET_JUMP_HOST"
require_env "IMWALLET_APP_HOST"
require_env "SSH_KEY_PATH"

if [[ ! -f "$SSH_KEY_PATH" ]]; then
  echo "[ERROR] SSH key file not found: $SSH_KEY_PATH" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONSOLE_DIST_DIR="$REPO_ROOT/imwallet-console/dist"
TMP_BUNDLE="$(mktemp "/tmp/imwallet-console-dist.XXXXXX.tgz")"
trap 'rm -f "$TMP_BUNDLE"' EXIT

if [[ ! -d "$CONSOLE_DIST_DIR" ]]; then
  echo "[ERROR] Console dist not found: $CONSOLE_DIST_DIR" >&2
  echo "        Build first with: cd imwallet-console && npm ci && npm run build" >&2
  exit 1
fi

echo "[INFO] Creating console bundle..."
tar -czf "$TMP_BUNDLE" -C "$CONSOLE_DIST_DIR" .

chmod 600 "$SSH_KEY_PATH"

SSH_OPTS=(
  -i "$SSH_KEY_PATH"
  -p "$IMWALLET_JUMP_PORT"
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
)

echo "[INFO] Uploading bundle to jump server..."
scp "${SSH_OPTS[@]}" "$TMP_BUNDLE" "${IMWALLET_JUMP_USER}@${IMWALLET_JUMP_HOST}:/tmp/imwallet-console-dist.tgz"

echo "[INFO] Deploying console bundle on app server (${IMWALLET_APP_HOST})..."
ssh "${SSH_OPTS[@]}" "${IMWALLET_JUMP_USER}@${IMWALLET_JUMP_HOST}" \
  "bash -s -- '${IMWALLET_APP_USER}' '${IMWALLET_APP_HOST}' '${IMWALLET_CONSOLE_TARGET_PATH}' '${IMWALLET_CONSOLE_RESTART_SERVICE}'" <<'JUMP_EOF'
set -euo pipefail
APP_USER="$1"
APP_HOST="$2"
TARGET_PATH="$3"
RESTART_SERVICE="$4"

ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "${APP_USER}@${APP_HOST}" \
  "bash -s -- '${TARGET_PATH}' '${RESTART_SERVICE}'" <<'APP_EOF'
set -euo pipefail
TARGET_PATH="$1"
RESTART_SERVICE="$2"

sudo mkdir -p "${TARGET_PATH}"
if [[ -d "${TARGET_PATH}" ]]; then
  sudo rm -rf "${TARGET_PATH}.prev"
  sudo cp -a "${TARGET_PATH}" "${TARGET_PATH}.prev"
  sudo rm -rf "${TARGET_PATH}"
fi
sudo mkdir -p "${TARGET_PATH}"
sudo tar -xzf /tmp/imwallet-console-dist.tgz -C "${TARGET_PATH}"

if [[ -n "${RESTART_SERVICE}" ]]; then
  if sudo systemctl list-unit-files | grep -q "^${RESTART_SERVICE}\.service"; then
    sudo systemctl restart "${RESTART_SERVICE}"
  fi
fi

if sudo systemctl list-unit-files | grep -q '^nginx\.service'; then
  sudo systemctl reload nginx || true
fi

rm -f /tmp/imwallet-console-dist.tgz
APP_EOF
JUMP_EOF

echo "[INFO] Console deploy completed."
