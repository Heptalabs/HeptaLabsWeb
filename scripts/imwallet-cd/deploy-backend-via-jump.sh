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
export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1
LC_ALL=C tar \
  --disable-copyfile \
  --no-mac-metadata \
  --exclude='._*' \
  --exclude='backend/node_modules' \
  --exclude='backend/.env' \
  --exclude='backend/.env.*' \
  --exclude='backend/ops/.embedded-postgres' \
  -czf "$TMP_BUNDLE" \
  -C "$REPO_ROOT" \
  backend database

chmod 600 "$SSH_KEY_PATH"

PROXY_COMMAND="ssh -i \"$SSH_KEY_PATH\" -p \"$IMWALLET_JUMP_PORT\" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -W %h:%p ${IMWALLET_JUMP_USER}@${IMWALLET_JUMP_HOST}"

SSH_OPTS=(
  -i "$SSH_KEY_PATH"
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
  -o "ProxyCommand=${PROXY_COMMAND}"
)

echo "[INFO] Uploading bundle to app server (${IMWALLET_APP_HOST}) via jump..."
scp "${SSH_OPTS[@]}" "$TMP_BUNDLE" "${IMWALLET_APP_USER}@${IMWALLET_APP_HOST}:/tmp/imwallet-backend-bundle.tgz"

echo "[INFO] Deploying bundle on app server (${IMWALLET_APP_HOST})..."
ssh "${SSH_OPTS[@]}" "${IMWALLET_APP_USER}@${IMWALLET_APP_HOST}" \
  "bash -s -- '${IMWALLET_BACKEND_SERVICE}' '${IMWALLET_BACKEND_HEALTH_URL}'" <<'APP_EOF'
set -euo pipefail
BACKEND_SERVICE="$1"
HEALTH_URL="$2"

TS="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="/tmp/imwallet-backend-release-${TS}"
ENV_STASH="/tmp/imwallet-backend-env-${TS}.env"
mkdir -p "${RELEASE_DIR}"
tar -xzf /tmp/imwallet-backend-bundle.tgz -C "${RELEASE_DIR}"

sudo mkdir -p /opt/imwallet
if [[ -f /opt/imwallet/backend/.env ]]; then
  sudo cp /opt/imwallet/backend/.env "${ENV_STASH}"
fi
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

if [[ -f "${ENV_STASH}" ]]; then
  sudo cp "${ENV_STASH}" /opt/imwallet/backend/.env
  sudo chown vm:vm /opt/imwallet/backend/.env || true
  sudo chmod 600 /opt/imwallet/backend/.env
elif [[ -f /opt/imwallet/backend.prev/.env && ! -f /opt/imwallet/backend/.env ]]; then
  sudo cp /opt/imwallet/backend.prev/.env /opt/imwallet/backend/.env
  sudo chown vm:vm /opt/imwallet/backend/.env || true
  sudo chmod 600 /opt/imwallet/backend/.env
fi

cd /opt/imwallet/backend
npm ci --omit=dev
npm run db:migrate
sudo systemctl restart "${BACKEND_SERVICE}"
sudo systemctl is-active --quiet "${BACKEND_SERVICE}"

health_ok=0
for _ in $(seq 1 30); do
  if curl -fsS "${HEALTH_URL}" >/dev/null; then
    health_ok=1
    break
  fi
  sleep 1
done

if [[ "$health_ok" -ne 1 ]]; then
  echo "[ERROR] Backend health check failed: ${HEALTH_URL}" >&2
  exit 1
fi

rm -rf "${RELEASE_DIR}"
sudo rm -f "${ENV_STASH}"
rm -f /tmp/imwallet-backend-bundle.tgz
APP_EOF

echo "[INFO] Backend deploy completed."
