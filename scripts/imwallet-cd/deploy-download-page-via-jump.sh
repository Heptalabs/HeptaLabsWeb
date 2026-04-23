#!/usr/bin/env bash
set -euo pipefail

# Deploy download landing (download/**, downloads/**) to app server via jump server.
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

IMWALLET_JUMP_USER="${IMWALLET_JUMP_USER:-vm}"
IMWALLET_JUMP_PORT="${IMWALLET_JUMP_PORT:-2222}"
IMWALLET_APP_USER="${IMWALLET_APP_USER:-vm}"
IMWALLET_APP_PORT="${IMWALLET_APP_PORT:-22}"
IMWALLET_DOWNLOAD_DOMAIN="${IMWALLET_DOWNLOAD_DOMAIN:-download.imwallet.app}"
IMWALLET_DOWNLOAD_ROOT="${IMWALLET_DOWNLOAD_ROOT:-/var/www/download.imwallet.app}"

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
TMP_BUNDLE="$(mktemp "/tmp/imwallet-download-bundle.XXXXXX.tgz")"
trap 'rm -f "$TMP_BUNDLE"' EXIT

if [[ ! -d "$REPO_ROOT/download" ]] || [[ ! -d "$REPO_ROOT/downloads" ]]; then
  echo "[ERROR] Required folders missing: download/ and downloads/" >&2
  exit 1
fi

echo "[INFO] Creating download landing bundle..."
COPYFILE_DISABLE=1 COPY_EXTENDED_ATTRIBUTES_DISABLE=1 tar -czf "$TMP_BUNDLE" -C "$REPO_ROOT" download downloads

chmod 600 "$SSH_KEY_PATH"

SSH_COMMON_OPTS=(
  -i "$SSH_KEY_PATH"
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
)

PROXY_COMMAND="ssh -i $SSH_KEY_PATH -p $IMWALLET_JUMP_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${IMWALLET_JUMP_USER}@${IMWALLET_JUMP_HOST} -W %h:%p"
APP_COMMON_OPTS=(
  "${SSH_COMMON_OPTS[@]}"
  -o "ProxyCommand=${PROXY_COMMAND}"
)
APP_SSH_OPTS=(
  "${APP_COMMON_OPTS[@]}"
  -p "$IMWALLET_APP_PORT"
)
APP_SCP_OPTS=(
  "${APP_COMMON_OPTS[@]}"
  -P "$IMWALLET_APP_PORT"
)

echo "[INFO] Uploading bundle to app server (${IMWALLET_APP_HOST}) via jump..."
scp "${APP_SCP_OPTS[@]}" "$TMP_BUNDLE" "${IMWALLET_APP_USER}@${IMWALLET_APP_HOST}:/tmp/imwallet-download-bundle.tgz"

echo "[INFO] Deploying download landing on app server (${IMWALLET_APP_HOST})..."
ssh "${APP_SSH_OPTS[@]}" "${IMWALLET_APP_USER}@${IMWALLET_APP_HOST}" \
  "bash -s -- '${IMWALLET_DOWNLOAD_DOMAIN}' '${IMWALLET_DOWNLOAD_ROOT}'" <<'APP_EOF'
set -euo pipefail
DOWNLOAD_DOMAIN="$1"
DOWNLOAD_ROOT="$2"

TMP_DIR="/tmp/imwallet-download-release"
rm -rf "${TMP_DIR}"
mkdir -p "${TMP_DIR}"
tar -xzf /tmp/imwallet-download-bundle.tgz -C "${TMP_DIR}"

sudo apt-get update -y >/dev/null
sudo apt-get install -y nginx >/dev/null

sudo mkdir -p "${DOWNLOAD_ROOT}"
sudo rm -rf "${DOWNLOAD_ROOT}/download"
sudo cp -a "${TMP_DIR}/download" "${DOWNLOAD_ROOT}/"

# Keep existing APK artifacts and only sync static metadata files under downloads/.
sudo mkdir -p "${DOWNLOAD_ROOT}/downloads"
if command -v rsync >/dev/null 2>&1; then
  sudo rsync -a --exclude='*.apk' "${TMP_DIR}/downloads/" "${DOWNLOAD_ROOT}/downloads/"
else
  sudo find "${TMP_DIR}/downloads" -maxdepth 1 -type f ! -name '*.apk' -exec sudo cp -a {} "${DOWNLOAD_ROOT}/downloads/" \;
fi

sudo chown -R www-data:www-data "${DOWNLOAD_ROOT}"

cat <<NGINX_CONF | sudo tee "/etc/nginx/sites-available/${DOWNLOAD_DOMAIN}" >/dev/null
server {
    listen 80;
    listen [::]:80;
    server_name ${DOWNLOAD_DOMAIN};

    root ${DOWNLOAD_ROOT};
    index index.html;

    location = / {
        return 302 /download/;
    }

    location / {
        try_files \$uri \$uri/ =404;
    }

    # Keep latest APK uncached so the landing button always serves the newest build.
    location = /downloads/imwallet-latest.apk {
        default_type application/vnd.android.package-archive;
        add_header Content-Disposition "attachment";
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
        expires -1;
        etag off;
        try_files \$uri =404;
    }

    location ~* \\.apk$ {
        default_type application/vnd.android.package-archive;
        add_header Content-Disposition "attachment";
        try_files \$uri =404;
    }
}
NGINX_CONF

sudo ln -sf "/etc/nginx/sites-available/${DOWNLOAD_DOMAIN}" "/etc/nginx/sites-enabled/${DOWNLOAD_DOMAIN}"
sudo nginx -t
sudo systemctl enable nginx >/dev/null
sudo systemctl restart nginx
sudo systemctl is-active --quiet nginx

curl -fsSI -H "Host: ${DOWNLOAD_DOMAIN}" http://127.0.0.1/download/ >/dev/null

rm -rf "${TMP_DIR}"
rm -f /tmp/imwallet-download-bundle.tgz
APP_EOF

echo "[INFO] Download landing deploy completed."
