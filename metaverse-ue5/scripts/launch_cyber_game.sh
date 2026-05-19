#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT_DIR/CyberMetaverse/CyberMetaverse.uproject"
UE_BIN="/Users/Shared/Epic Games/UE_5.7/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor"

exec "$UE_BIN" "$PROJECT" /Game/Maps/L_CyberPlaza -game -log
