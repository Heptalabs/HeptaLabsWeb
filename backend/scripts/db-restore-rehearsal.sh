#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
ENV_FILE="${2:-.env.production}"
ENV_KEYS_FILE_ARG="${3:-${ENV_KEYS_FILE:-}}"

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "usage: bash ./scripts/db-restore-rehearsal.sh <backup.dump> [env-file] [env-keys-file]"
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "[fail] backup file not found: ${BACKUP_FILE}"
  exit 1
fi

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

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[fail] DATABASE_URL is missing"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[fail] node not found"
  exit 1
fi

echo "[db-restore-rehearsal] env file: ${ENV_FILE}"
if [[ -n "${ENV_KEYS_FILE_ARG}" ]]; then
  echo "[db-restore-rehearsal] env keys file: ${ENV_KEYS_FILE_ARG}"
fi
echo "[db-restore-rehearsal] backup: ${BACKUP_FILE}"

if [[ "${BACKUP_FILE}" == *.json ]]; then
  echo "[db-restore-rehearsal] using JSON fallback restore"
  node ./scripts/db-restore-rehearsal-json.mjs "${DATABASE_URL}" "${BACKUP_FILE}" "${KEEP_REHEARSAL_DB:-0}"
  exit $?
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[fail] psql not found (required for .dump restore)"
  echo "[hint] create a JSON backup first, then restore with fallback:"
  echo "       npm run db:backup -- ${ENV_FILE}"
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "[fail] pg_restore not found (required for .dump restore)"
  echo "[hint] create a JSON backup first, then restore with fallback:"
  echo "       npm run db:backup -- ${ENV_FILE}"
  exit 1
fi

echo "[db-restore-rehearsal] .dump restore path requires psql/pg_restore; use fallback JSON if unavailable."
exit 1
