#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$BASE_DIR/.runtime"
PID_FILE="$RUNTIME_DIR/pixelstreaming-infra.pid"

kill_port_if_listening() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill -TERM 2>/dev/null || true
    sleep 1
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill -KILL 2>/dev/null || true
    fi
  fi
}

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$PID" ]] && ps -p "$PID" >/dev/null 2>&1; then
    kill -TERM "$PID" 2>/dev/null || true
    sleep 1
    if ps -p "$PID" >/dev/null 2>&1; then
      kill -KILL "$PID" 2>/dev/null || true
    fi
    echo "[infra] stopped pid=$PID"
  fi
  rm -f "$PID_FILE"
fi

kill_port_if_listening 8080
kill_port_if_listening 8888
kill_port_if_listening 8889

echo "[infra] ports 8080/8888/8889 cleaned"
