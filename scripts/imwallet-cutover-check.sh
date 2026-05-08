#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STRICT_MODE="${STRICT_MODE:-0}"
BASE_URL="${BASE_URL:-http://127.0.0.1:4000/api/v1}"
ENV_FILE="${ENV_FILE:-.env.production}"

echo "[imwallet-cutover-check] root=${ROOT_DIR}"
echo "[imwallet-cutover-check] strict=${STRICT_MODE}"

run_step() {
  local title="$1"
  shift
  echo ""
  echo "==> ${title}"
  "$@"
}

run_step "backend check:prod-env" \
  bash -lc "cd \"${ROOT_DIR}/backend\" && npm run check:prod-env -- ${ENV_FILE}"

run_step "backend check:providers" \
  bash -lc "cd \"${ROOT_DIR}/backend\" && npm run check:providers -- ${ENV_FILE}"

if [[ "${STRICT_MODE}" == "1" ]]; then
  run_step "backend preflight strict" \
    bash -lc "cd \"${ROOT_DIR}/backend\" && npm run preflight:prod:strict -- ${BASE_URL} ${ENV_FILE}"
else
  run_step "backend preflight" \
    bash -lc "cd \"${ROOT_DIR}/backend\" && npm run preflight:prod -- ${BASE_URL} ${ENV_FILE}"
fi

run_step "backend audit(prod deps)" \
  bash -lc "cd \"${ROOT_DIR}/backend\" && npm audit --omit=dev"

run_step "app type/test/build" \
  bash -lc "cd \"${ROOT_DIR}/imwallet-app\" && npm run typecheck && npm run test:run && npm run build:web"

run_step "app audit(prod deps)" \
  bash -lc "cd \"${ROOT_DIR}/imwallet-app\" && npm audit --omit=dev"

run_step "console type/test/build (mock env)" \
  bash -lc "cd \"${ROOT_DIR}/imwallet-console\" && npm run typecheck && npm run test:run && npm run build"

run_step "console build (backend mode env)" \
  bash -lc "cd \"${ROOT_DIR}/imwallet-console\" && VITE_USE_MOCK_API=false npm run build"

run_step "console audit(prod deps)" \
  bash -lc "cd \"${ROOT_DIR}/imwallet-console\" && npm audit --omit=dev"

echo ""
echo "[imwallet-cutover-check] done"
