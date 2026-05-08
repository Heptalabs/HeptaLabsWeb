#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"
OUTPUT_DIR="${2:-ops/backups}"
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

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[fail] DATABASE_URL is missing"
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"
ts="$(date +%Y%m%d-%H%M%S)"
use_fallback=0

if ! command -v pg_dump >/dev/null 2>&1; then
  use_fallback=1
fi

if [[ "${use_fallback}" == "1" ]]; then
  backup_file="${OUTPUT_DIR%/}/imwallet-db-${ts}.json"
else
  backup_file="${OUTPUT_DIR%/}/imwallet-db-${ts}.dump"
fi
checksum_file="${backup_file}.sha256"

echo "[db-backup] env file: ${ENV_FILE}"
if [[ -n "${ENV_KEYS_FILE_ARG}" ]]; then
  echo "[db-backup] env keys file: ${ENV_KEYS_FILE_ARG}"
fi
echo "[db-backup] output: ${backup_file}"

if [[ "${use_fallback}" == "1" ]]; then
  echo "[db-backup] pg_dump not found -> using JSON fallback backup"
  node ./scripts/db-backup-fallback.mjs "${DATABASE_URL}" "${backup_file}"
else
  pg_dump \
    --format=custom \
    --no-owner \
    --no-privileges \
    --dbname="${DATABASE_URL}" \
    --file="${backup_file}"
fi

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${backup_file}" > "${checksum_file}"
  echo "[db-backup] checksum: ${checksum_file}"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${backup_file}" > "${checksum_file}"
  echo "[db-backup] checksum: ${checksum_file}"
else
  echo "[warn] shasum/sha256sum not found; checksum skipped"
fi

echo "[db-backup] done"
