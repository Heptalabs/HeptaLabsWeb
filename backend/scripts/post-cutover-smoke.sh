#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:4000/api/v1}"
ENV_FILE="${2:-.env.production}"
ENV_KEYS_FILE_ARG="${3:-${ENV_KEYS_FILE:-}}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a && source "${ENV_FILE}" && set +a
fi

if [[ -z "${ENV_KEYS_FILE_ARG}" && "${ENV_FILE}" == ".env.production" && -f ".env.production.keys" ]]; then
  ENV_KEYS_FILE_ARG=".env.production.keys"
fi

if [[ -n "${ENV_KEYS_FILE_ARG}" && -f "${ENV_KEYS_FILE_ARG}" ]]; then
  # shellcheck disable=SC1090
  set -a && source "${ENV_KEYS_FILE_ARG}" && set +a
fi

echo "[post-cutover-smoke] base=${BASE_URL}"

echo "[post-cutover-smoke] 1) health"
curl -fsS "${BASE_URL}/health" >/dev/null
echo "[ok] health"

echo "[post-cutover-smoke] 2) market feeds"
curl -fsS "${BASE_URL}/market/prices?symbols=BTC,ETH,USDT,SOL" >/dev/null
curl -fsS "${BASE_URL}/market/popular-tokens?limit=5" >/dev/null
curl -fsS "${BASE_URL}/market/fx-rates" >/dev/null
echo "[ok] market"

echo "[post-cutover-smoke] 3) holders"
bash ./scripts/smoke-holders.sh "${BASE_URL}"

echo "[post-cutover-smoke] 4) discover content"
bash ./scripts/smoke-content.sh "${BASE_URL}"

echo "[post-cutover-smoke] 5) authz/rbac"
bash ./scripts/smoke-authz-rbac.sh "${BASE_URL}"

echo "[post-cutover-smoke] done"
