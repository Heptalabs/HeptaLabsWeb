#!/usr/bin/env bash
set -euo pipefail

URL="https://www.unrealengine.com/en-US/download"
if command -v open >/dev/null 2>&1; then
  open "$URL"
  echo "[open] $URL"
else
  echo "$URL"
fi
