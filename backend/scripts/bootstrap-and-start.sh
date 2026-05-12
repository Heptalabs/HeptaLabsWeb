#!/usr/bin/env sh
set -eu

MAX_RETRIES="${DB_BOOTSTRAP_MAX_RETRIES:-40}"
RETRY_INTERVAL="${DB_BOOTSTRAP_RETRY_INTERVAL_SECONDS:-2}"
APP_START_SCRIPT="${APP_START_SCRIPT:-start}"
DB_BOOTSTRAP_MODE="${DB_BOOTSTRAP_MODE:-migrate}"
ATTEMPT=1

case "$DB_BOOTSTRAP_MODE" in
  migrate|bootstrap|migrate+seed|seed) ;;
  *)
    echo "[bootstrap] unsupported DB_BOOTSTRAP_MODE: $DB_BOOTSTRAP_MODE" >&2
    exit 1
    ;;
esac

if [ "${NODE_ENV:-}" = "production" ]; then
  if [ "$DB_BOOTSTRAP_MODE" = "seed" ] || [ "$DB_BOOTSTRAP_MODE" = "bootstrap" ] || [ "$DB_BOOTSTRAP_MODE" = "migrate+seed" ]; then
    if [ "${ALLOW_PROD_DB_SEED:-false}" != "true" ]; then
      echo "[bootstrap] refusing production seed/bootstrap without ALLOW_PROD_DB_SEED=true" >&2
      exit 1
    fi
  fi
fi

while [ "$ATTEMPT" -le "$MAX_RETRIES" ]; do
  BOOTSTRAP_CMD="npm run db:migrate"
  if [ "$DB_BOOTSTRAP_MODE" = "bootstrap" ] || [ "$DB_BOOTSTRAP_MODE" = "migrate+seed" ]; then
    BOOTSTRAP_CMD="npm run db:bootstrap"
  elif [ "$DB_BOOTSTRAP_MODE" = "seed" ]; then
    BOOTSTRAP_CMD="npm run db:seed"
  fi

  echo "[bootstrap] attempt ${ATTEMPT}/${MAX_RETRIES}: ${BOOTSTRAP_CMD}"

  if sh -c "${BOOTSTRAP_CMD}"; then
    echo "[bootstrap] database bootstrap completed"
    break
  fi

  if [ "$ATTEMPT" -eq "$MAX_RETRIES" ]; then
    echo "[bootstrap] failed after ${MAX_RETRIES} attempts" >&2
    exit 1
  fi

  ATTEMPT=$((ATTEMPT + 1))
  sleep "$RETRY_INTERVAL"
done

echo "[bootstrap] starting API server"
exec npm run "$APP_START_SCRIPT"
