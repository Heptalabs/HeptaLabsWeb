#!/usr/bin/env sh
set -eu

MAX_RETRIES="${DB_BOOTSTRAP_MAX_RETRIES:-40}"
RETRY_INTERVAL="${DB_BOOTSTRAP_RETRY_INTERVAL_SECONDS:-2}"
APP_START_SCRIPT="${APP_START_SCRIPT:-start}"
ATTEMPT=1

while [ "$ATTEMPT" -le "$MAX_RETRIES" ]; do
  echo "[bootstrap] attempt ${ATTEMPT}/${MAX_RETRIES}: npm run db:bootstrap"

  if npm run db:bootstrap; then
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
