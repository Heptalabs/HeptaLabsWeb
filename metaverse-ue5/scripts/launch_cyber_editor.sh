#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT_DIR/CyberMetaverse/CyberMetaverse.uproject"
UE_BIN="/Users/Shared/Epic Games/UE_5.7/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor"

if [[ ! -f "$PROJECT" ]]; then
  echo "Project not found: $PROJECT"
  exit 1
fi

exec "$UE_BIN" "$PROJECT" /Game/Maps/L_CyberPlaza
