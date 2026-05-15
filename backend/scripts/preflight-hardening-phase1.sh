#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BOOTSTRAP_SCRIPT="$ROOT_DIR/scripts/bootstrap-and-start.sh"
AUTH_MW="$ROOT_DIR/src/middleware/auth.js"
API_ROUTES="$ROOT_DIR/src/routes/api.js"
DISCOVER_SERVICE="$ROOT_DIR/src/services/discover-content.js"
MARKET_SERVICE="$ROOT_DIR/src/services/market-price.js"
DOCKER_COMPOSE="$ROOT_DIR/docker-compose.yml"
MIGRATE_SCRIPT="$ROOT_DIR/src/db/migrate.js"
SEED_SCRIPT="$ROOT_DIR/src/db/seed.js"
SEED_SQL="$ROOT_DIR/../database/seed_v1.sql"

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

pass() {
  echo "[OK] $1"
}

has_pattern() {
  local pattern="$1"
  shift
  grep -RinE "$pattern" "$@" >/dev/null 2>&1
}

require_match() {
  local pattern="$1"
  local target="$2"
  local label="$3"
  if ! has_pattern "$pattern" "$target"; then
    fail "$label (pattern: $pattern)"
  fi
  pass "$label"
}

require_no_match() {
  local pattern="$1"
  local target="$2"
  local label="$3"
  if has_pattern "$pattern" "$target"; then
    fail "$label (pattern: $pattern)"
  fi
  pass "$label"
}

echo "== Backend Hardening Preflight =="

require_match "DB_BOOTSTRAP_MODE=\"\\$\\{DB_BOOTSTRAP_MODE:-migrate\\}\"" "$BOOTSTRAP_SCRIPT" "Bootstrap defaults to migrate mode"
require_match "refusing production seed/bootstrap without ALLOW_PROD_DB_SEED=true" "$BOOTSTRAP_SCRIPT" "Production seed/bootstrap guard exists"
require_match "schema_migrations" "$MIGRATE_SCRIPT" "Migration runner uses schema_migrations table"
require_match "pg_advisory_lock" "$MIGRATE_SCRIPT" "Migration runner uses advisory lock"
require_match "checksum_sha256" "$MIGRATE_SCRIPT" "Migration runner records checksum"
require_match "ALLOW_PROD_DB_SEED" "$SEED_SCRIPT" "Seed runner has production guard"
require_no_match "Admin!234|admin@imwallet\\.app|crypt\\(" "$SEED_SQL" "Seed SQL does not contain hardcoded admin credentials"
require_match "algorithms:\\s*\\['HS256'\\]" "$AUTH_MW" "JWT verify algorithm pinned to HS256"
require_match "signupRateLimiter" "$API_ROUTES" "Signup rate limiter is wired"
require_match "assertValidAddress\\(usdtAddress, 'usdtAddress', 'USDT'\\)" "$API_ROUTES" "USDT address validation uses strict USDT mode"
require_match "isSupportedImageMagicBytes" "$DISCOVER_SERVICE" "Discover icon magic-byte validation enabled"
require_match "normalizeValidatedExternalUrl\\(text, 'iconUrl'\\)" "$DISCOVER_SERVICE" "Discover icon URL validation enforces allowlist/HTTPS"
require_no_match "google\\.com/s2/favicons|icons\\.duckduckgo\\.com" "$DISCOVER_SERVICE" "Discover icon verification does not use third-party favicon proxy"
require_no_match "r\\.jina\\.ai" "$MARKET_SERVICE" "Jina proxy fallback removed"
require_no_match "CMC_DEFAULT_KRW_RATE|CMC_DEFAULT_CNY_RATE" "$MARKET_SERVICE" "Hardcoded FX fallback constants removed"
require_match "POSTGRES_PASSWORD:\\s*\\$\\{POSTGRES_PASSWORD:\\?set POSTGRES_PASSWORD\\}" "$DOCKER_COMPOSE" "Compose requires POSTGRES_PASSWORD env"
require_match "JWT_SECRET:\\s*\\$\\{JWT_SECRET:\\?set JWT_SECRET\\}" "$DOCKER_COMPOSE" "Compose requires JWT_SECRET env"

echo "== Preflight passed =="
