#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_TSX="$ROOT_DIR/App.tsx"
APP_CATALOG="$ROOT_DIR/src/data/appCatalog.ts"
WALLET_DOMAIN="$ROOT_DIR/src/domain/wallet-domain.ts"
ADDRESS_ENGINE="$ROOT_DIR/src/services/addressEngine.ts"
MANIFEST="$ROOT_DIR/android/app/src/main/AndroidManifest.xml"
NETWORK_CONFIG="$ROOT_DIR/android/app/src/main/res/xml/network_security_config.xml"
BUILD_GRADLE="$ROOT_DIR/android/app/build.gradle"
APP_JSON="$ROOT_DIR/app.json"
PACKAGE_JSON="$ROOT_DIR/package.json"
EAS_JSON="$ROOT_DIR/eas.json"

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

pass() {
  echo "[OK] $1"
}

require_no_match() {
  local pattern="$1"
  local target="$2"
  local label="$3"
  if rg -n "$pattern" "$target" >/dev/null 2>&1; then
    fail "$label (pattern: $pattern)"
  fi
  pass "$label"
}

require_match() {
  local pattern="$1"
  local target="$2"
  local label="$3"
  if ! rg -n "$pattern" "$target" >/dev/null 2>&1; then
    fail "$label (pattern: $pattern)"
  fi
  pass "$label"
}

echo "== IMWallet Release Security Preflight =="

if rg -n "DEFAULT_COMPAT_SEEDS|clipboard-read|clipboard-write|api\\.qrserver\\.com|Math\\.random\\(" \
  "$APP_TSX" "$ROOT_DIR/src" "$ROOT_DIR/android" >/dev/null 2>&1; then
  fail "No critical insecure patterns in app source"
fi
pass "No critical insecure patterns in app source"
require_no_match "seed-book-|seed-tx-|chainDemoAddressPool" "$APP_TSX" "No demo seed/book/tx path in App.tsx"
require_no_match "mockWallet" "$APP_TSX" "No mockWallet import in App.tsx"
require_no_match "mockWallet" "$ROOT_DIR/src" "No mockWallet reference in src"
require_no_match "seed-dex-|seed-lending-|seed-yield-|seed-solana-|seed-market-|seed-social-|seed-games-|topup-|fallback-seed-|seed-popular-|Explore demo wallet|데모 지갑|演示钱包" "$APP_TSX" "No discover demo/topup fallback path in App.tsx"
require_no_match "picsum\\.photos|Blue Ape|Sol Pixel|BSC Dragon|Tron Relic" "$APP_CATALOG" "No seeded NFT demo fixtures in app catalog"
require_no_match "0x55d398326f99059fF775485246999027B3197955" "$WALLET_DOMAIN" "No BSC USDT contract in wallet domain address defaults"
require_no_match "recovery-index-scan|EXPO_PUBLIC_ENABLE_RECOVERY_REMOTE_SCAN" "$ROOT_DIR/src/services/recoveryAccountIndexScanner.ts" "Recovery index scan is local-only (no remote seed scan)"
require_match "toChecksumEvmAddress" "$ADDRESS_ENGINE" "EVM address normalization uses checksum conversion"
require_no_match "android\\.debug\\.keystore|signingConfigs\\.debug" "$BUILD_GRADLE" "No debug signing in release config"

require_match "android:networkSecurityConfig=\"@xml/network_security_config\"" "$MANIFEST" "Manifest references Network Security Config"
[[ -f "$NETWORK_CONFIG" ]] || fail "network_security_config.xml file missing"
pass "network_security_config.xml exists"

for perm in RECORD_AUDIO SYSTEM_ALERT_WINDOW WRITE_EXTERNAL_STORAGE READ_EXTERNAL_STORAGE USE_FINGERPRINT; do
  require_no_match "$perm" "$MANIFEST" "Forbidden Android permission removed: $perm"
done

require_match "IMWALLET_UPLOAD_STORE_FILE" "$BUILD_GRADLE" "Release signing requires IMWALLET_UPLOAD_* props"
require_match "\"buildType\": \"app-bundle\"" "$EAS_JSON" "EAS production build type is app-bundle"

APP_VERSION="$(node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(j.expo?.version||''));" "$APP_JSON")"
PKG_VERSION="$(node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(j.version||''));" "$PACKAGE_JSON")"
GRADLE_VERSION_NAME="$(sed -n 's/^[[:space:]]*versionName[[:space:]]*"\(.*\)"/\1/p' "$BUILD_GRADLE" | head -n 1)"
if [[ -z "$APP_VERSION" || -z "$PKG_VERSION" ]]; then
  fail "Unable to read app/package versions"
fi
if [[ "$APP_VERSION" != "$PKG_VERSION" ]]; then
  fail "Version mismatch: app.json=$APP_VERSION package.json=$PKG_VERSION"
fi
pass "Version aligned: $APP_VERSION"
if [[ -z "$GRADLE_VERSION_NAME" ]]; then
  fail "Unable to read android/app/build.gradle versionName"
fi
if [[ "$APP_VERSION" != "$GRADLE_VERSION_NAME" ]]; then
  fail "Version mismatch: app.json=$APP_VERSION build.gradle=$GRADLE_VERSION_NAME"
fi
pass "Version aligned with build.gradle: $GRADLE_VERSION_NAME"

require_match "\"scheme\": \"imwallet\"" "$APP_JSON" "Deep link scheme configured"
require_match "\"targetSdkVersion\": 35" "$APP_JSON" "targetSdkVersion set to 35"

echo "== Preflight passed =="
