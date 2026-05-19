#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INFRA_PARENT="$BASE_DIR/infrastructure"
INFRA_DIR="$INFRA_PARENT/PixelStreamingInfrastructure"

mkdir -p "$INFRA_PARENT"

if [[ ! -d "$INFRA_DIR/.git" ]]; then
  git clone https://github.com/EpicGamesExt/PixelStreamingInfrastructure.git "$INFRA_DIR"
fi

cd "$INFRA_DIR"
git fetch --all --prune
if git rev-parse --verify UE5.7 >/dev/null 2>&1; then
  git checkout UE5.7
else
  git checkout -b UE5.7 origin/UE5.7
fi

echo "[setup] repo ready: $INFRA_DIR"
echo "[setup] branch: $(git rev-parse --abbrev-ref HEAD)"
echo "[setup] commit: $(git rev-parse --short HEAD)"
