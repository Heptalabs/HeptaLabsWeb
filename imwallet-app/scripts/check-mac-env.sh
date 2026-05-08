#!/usr/bin/env bash
set -euo pipefail

echo "[IMWallet] mac environment check"

required=(node npm npx)
optional=(xcodebuild pod adb emulator)
missing_required=false

for cmd in "${required[@]}"; do
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "  - $cmd: ok"
  else
    echo "  - $cmd: missing"
    missing_required=true
  fi
done

for cmd in "${optional[@]}"; do
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "  - $cmd: ok (optional)"
  else
    echo "  - $cmd: not found (optional)"
  fi
done

if command -v xcodebuild >/dev/null 2>&1; then
  if xcodebuild -version >/dev/null 2>&1; then
    echo "  - Xcode runtime: ok"
  else
    echo "  - Xcode runtime: command line tools only (full Xcode required for iOS simulator)"
  fi
fi

if [ "$missing_required" = true ]; then
  echo "[IMWallet] result: FAIL (install required tools first)"
  exit 1
fi

echo "[IMWallet] result: PASS"
