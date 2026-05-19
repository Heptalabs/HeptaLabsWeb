#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_INFRA_DIR="$BASE_DIR/infrastructure/PixelStreamingInfrastructure"
ENGINE_INFRA_DIR="/Users/Shared/Epic Games/UE_5.7/Engine/Plugins/Media/PixelStreaming/Resources/WebServers"
INFRA_DIR="${PIXEL_STREAMING_INFRA_DIR:-}"
if [[ -z "$INFRA_DIR" ]]; then
  if [[ -f "$WORKSPACE_INFRA_DIR/SignallingWebServer/platform_scripts/bash/start.sh" ]]; then
    INFRA_DIR="$WORKSPACE_INFRA_DIR"
  elif [[ -f "$ENGINE_INFRA_DIR/SignallingWebServer/platform_scripts/bash/start.sh" ]]; then
    INFRA_DIR="$ENGINE_INFRA_DIR"
  else
    echo "[infra] no infra found locally. bootstrapping UE5.7 infrastructure..."
    "$BASE_DIR/scripts/setup_infra.sh"
    INFRA_DIR="$WORKSPACE_INFRA_DIR"
  fi
fi
RUNTIME_DIR="$BASE_DIR/.runtime"
LOG_FILE="$RUNTIME_DIR/pixelstreaming-infra.log"
PID_FILE="$RUNTIME_DIR/pixelstreaming-infra.pid"

PLAYER_PORT="${PLAYER_PORT:-8080}"
STREAMER_PORT="${STREAMER_PORT:-8888}"
SFU_PORT="${SFU_PORT:-8889}"

mkdir -p "$RUNTIME_DIR"

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$OLD_PID" ]] && ps -p "$OLD_PID" >/dev/null 2>&1; then
    echo "[infra] already running (pid=$OLD_PID)."
    echo "[infra] log: $LOG_FILE"
    exit 0
  fi
fi

if [[ ! -f "$INFRA_DIR/SignallingWebServer/platform_scripts/bash/start.sh" ]]; then
  echo "[infra] missing SignallingWebServer start script under: $INFRA_DIR"
  echo "[infra] set PIXEL_STREAMING_INFRA_DIR if your path is different."
  exit 1
fi

if [[ -d "$INFRA_DIR/.git" ]]; then
  (
    cd "$INFRA_DIR"
    CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD || true)"
    if [[ "$CURRENT_BRANCH" != "UE5.7" ]]; then
      git checkout UE5.7 >/dev/null 2>&1 || true
    fi
  )
fi

CMD="./SignallingWebServer/platform_scripts/bash/start.sh --nosudo -- --player_port $PLAYER_PORT --streamer_port $STREAMER_PORT --sfu_port $SFU_PORT"

(
  cd "$INFRA_DIR"
  nohup bash -lc "$CMD" >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
)

sleep 2
NEW_PID="$(cat "$PID_FILE")"
if ! ps -p "$NEW_PID" >/dev/null 2>&1; then
  echo "[infra] failed to start (process exited). recent log:"
  tail -n 120 "$LOG_FILE" || true
  exit 1
fi

READY=0
for _ in {1..30}; do
  if curl -fsS --max-time 1 "http://127.0.0.1:$PLAYER_PORT" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "$READY" -eq 1 ]]; then
  echo "[infra] started (pid=$NEW_PID)"
  echo "[infra] player page: http://127.0.0.1:$PLAYER_PORT"
  echo "[infra] streamer ws: ws://127.0.0.1:$STREAMER_PORT"
  echo "[infra] log: $LOG_FILE"
else
  echo "[infra] process is alive but player page is not responding."
  echo "[infra] recent log:"
  tail -n 160 "$LOG_FILE" || true
  exit 1
fi
