#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT_DIR/CyberMetaverse/CyberMetaverse.uproject"
UE_BIN="/Users/Shared/Epic Games/UE_5.7/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor"

SIGNALLING_URL="ws://127.0.0.1:8888"

exec "$UE_BIN" "$PROJECT" /Game/Maps/L_CyberPlaza -game -RenderOffscreen -ForceRes -ResX=1920 -ResY=1080 -PixelStreamingIP=127.0.0.1 -PixelStreamingPort=8888 -PixelStreamingURL="$SIGNALLING_URL" -AudioMixer -log
