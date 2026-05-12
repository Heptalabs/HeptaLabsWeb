#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
APP_DIR="$ROOT_DIR/imwallet-app"
AAB_PATH="$APP_DIR/android/app/build/outputs/bundle/release/app-release.aab"
CREDENTIALS_FILE="$HOME/.local/imwallet-signing/credentials.env"
JAVA_HOME_LOCAL="$HOME/.local/jdks/temurin-17/Contents/Home"

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

pass() {
  echo "[OK] $1"
}

echo "== Gate 22: Backend hardening preflight =="
(cd "$BACKEND_DIR" && npm run preflight:hardening:phase1)

echo "== Gate 22: App security preflight =="
(cd "$APP_DIR" && npm run preflight:release:security)

echo "== Gate 22: Required pattern zero-check =="
if rg -n "DEFAULT_COMPAT_SEEDS|clipboard-read|clipboard-write|signingConfigs\.debug|androiddebugkey" \
  "$APP_DIR/App.tsx" \
  "$APP_DIR/src" \
  "$APP_DIR/android/app/build.gradle" >/dev/null 2>&1; then
  fail "Critical forbidden patterns found in app source"
fi
pass "Critical forbidden patterns absent"

[[ -f "$AAB_PATH" ]] || fail "AAB missing: $AAB_PATH"
pass "AAB exists"

if [[ -f "$CREDENTIALS_FILE" && -x "$JAVA_HOME_LOCAL/bin/jarsigner" ]]; then
  # shellcheck disable=SC1090
  source "$CREDENTIALS_FILE"
  "$JAVA_HOME_LOCAL/bin/jarsigner" -verify -verbose "$AAB_PATH" >/tmp/imwallet-jarsigner-verify.log 2>&1 || fail "AAB jarsigner verify failed"
  pass "AAB jarsigner verify passed"
else
  echo "[WARN] Signing verify skipped (credentials or local JDK missing)"
fi

echo "== Gate 22 passed =="
