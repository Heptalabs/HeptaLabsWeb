#!/usr/bin/env bash
set -euo pipefail

# Deploy backend/database bundle to app server through jump server.
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
# - IMWALLET_BACKEND_SERVICE (default: imwallet-backend)
# - IMWALLET_BACKEND_HEALTH_URL (default: http://127.0.0.1:4000/api/v1/health)

IMWALLET_JUMP_USER="${IMWALLET_JUMP_USER:-vm}"
IMWALLET_JUMP_PORT="${IMWALLET_JUMP_PORT:-2222}"
IMWALLET_APP_USER="${IMWALLET_APP_USER:-vm}"
IMWALLET_BACKEND_SERVICE="${IMWALLET_BACKEND_SERVICE:-imwallet-backend}"
IMWALLET_BACKEND_HEALTH_URL="${IMWALLET_BACKEND_HEALTH_URL:-http://127.0.0.1:4000/api/v1/health}"

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
TMP_BUNDLE="$(mktemp "/tmp/imwallet-backend-bundle.XXXXXX.tgz")"
trap 'rm -f "$TMP_BUNDLE"' EXIT

echo "[INFO] Creating backend bundle..."
tar \
  --exclude='backend/node_modules' \
  --exclude='backend/ops/.embedded-postgres' \
  -czf "$TMP_BUNDLE" \
  -C "$REPO_ROOT" \
  backend database

chmod 600 "$SSH_KEY_PATH"

SSH_OPTS=(
  -i "$SSH_KEY_PATH"
  -p "$IMWALLET_JUMP_PORT"
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
)

echo "[INFO] Uploading bundle to jump server..."
scp "${SSH_OPTS[@]}" "$TMP_BUNDLE" "${IMWALLET_JUMP_USER}@${IMWALLET_JUMP_HOST}:/tmp/imwallet-backend-bundle.tgz"

echo "[INFO] Deploying bundle on app server (${IMWALLET_APP_HOST})..."
ssh "${SSH_OPTS[@]}" "${IMWALLET_JUMP_USER}@${IMWALLET_JUMP_HOST}" \
  "bash -s -- '${IMWALLET_APP_USER}' '${IMWALLET_APP_HOST}' '${IMWALLET_BACKEND_SERVICE}' '${IMWALLET_BACKEND_HEALTH_URL}'" <<'JUMP_EOF'
set -euo pipefail
APP_USER="$1"
APP_HOST="$2"
BACKEND_SERVICE="$3"
HEALTH_URL="$4"

ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "${APP_USER}@${APP_HOST}" \
  "bash -s -- '${BACKEND_SERVICE}' '${HEALTH_URL}'" <<'APP_EOF'
set -euo pipefail
BACKEND_SERVICE="$1"
HEALTH_URL="$2"

TS="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="/tmp/imwallet-backend-release-${TS}"
mkdir -p "${RELEASE_DIR}"
tar -xzf /tmp/imwallet-backend-bundle.tgz -C "${RELEASE_DIR}"

sudo mkdir -p /opt/imwallet
if [[ -d /opt/imwallet/backend ]]; then
  sudo rm -rf /opt/imwallet/backend.prev
  sudo mv /opt/imwallet/backend /opt/imwallet/backend.prev
fi
if [[ -d /opt/imwallet/database ]]; then
  sudo rm -rf /opt/imwallet/database.prev
  sudo mv /opt/imwallet/database /opt/imwallet/database.prev
fi

sudo cp -a "${RELEASE_DIR}/backend" /opt/imwallet/backend
sudo cp -a "${RELEASE_DIR}/database" /opt/imwallet/database

cd /opt/imwallet/backend
npm ci --omit=dev
npm run db:migrate
sudo systemctl restart "${BACKEND_SERVICE}"
sudo systemctl is-active --quiet "${BACKEND_SERVICE}"
curl -fsS "${HEALTH_URL}" >/dev/null

rm -rf "${RELEASE_DIR}"
rm -f /tmp/imwallet-backend-bundle.tgz
APP_EOF
JUMP_EOF

echo "[INFO] Backend deploy completed."
