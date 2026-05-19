#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$BASE_DIR/.runtime/pixelstreaming-infra.pid"
LOG_FILE="$BASE_DIR/.runtime/pixelstreaming-infra.log"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$PID" ]] && ps -p "$PID" >/dev/null 2>&1; then
    echo "[infra] running pid=$PID"
  else
    echo "[infra] stale pid file found, removing"
    rm -f "$PID_FILE"
  fi
else
  echo "[infra] pid file not found"
fi

echo "[infra] listening ports"
lsof -iTCP -sTCP:LISTEN -nP | grep -E ':8080|:8888|:8889' || echo "  - none"

if [[ -f "$LOG_FILE" ]]; then
  echo "[infra] log tail"
  tail -n 20 "$LOG_FILE"
fi
