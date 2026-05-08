#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:4000/api/v1}"
ENV_FILE="${2:-.env.production}"
ENV_KEYS_FILE_ARG="${3:-${ENV_KEYS_FILE:-}}"

echo "[preflight-prod] 1) check prod env"
if [[ -n "${ENV_KEYS_FILE_ARG}" ]]; then
  ENV_KEYS_FILE="${ENV_KEYS_FILE_ARG}" bash ./scripts/check-prod-env.sh "${ENV_FILE}"
else
  bash ./scripts/check-prod-env.sh "${ENV_FILE}"
fi

echo "[preflight-prod] 2) check provider connectivity"
if [[ -n "${ENV_KEYS_FILE_ARG}" ]]; then
  ENV_KEYS_FILE="${ENV_KEYS_FILE_ARG}" bash ./scripts/check-provider-connectivity.sh "${ENV_FILE}"
else
  bash ./scripts/check-provider-connectivity.sh "${ENV_FILE}"
fi

echo "[preflight-prod] 3) healthcheck"
curl -fsS "${BASE_URL%/}/health" >/dev/null
echo "[ok] health endpoint"

echo "[preflight-prod] 4) holder smoke"
bash ./scripts/smoke-holders.sh "${BASE_URL%/}"

echo "[preflight-prod] 5) content smoke"
bash ./scripts/smoke-content.sh "${BASE_URL%/}"

echo "[preflight-prod] done"
