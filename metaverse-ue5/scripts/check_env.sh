#!/usr/bin/env bash
set -euo pipefail

echo "[check] UnrealEditor"
if command -v UnrealEditor >/dev/null 2>&1; then
  echo "  - found: $(command -v UnrealEditor)"
else
  echo "  - not found"
fi

echo "[check] docker"
if command -v docker >/dev/null 2>&1; then
  echo "  - found: $(command -v docker)"
else
  echo "  - not found"
fi

echo "[check] node"
if command -v node >/dev/null 2>&1; then
  echo "  - found: $(command -v node)"
else
  echo "  - not found"
fi
