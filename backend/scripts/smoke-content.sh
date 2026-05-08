#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:4000/api/v1}"
CONTENT_ADMIN_REQUIRE_AUTH="${CONTENT_ADMIN_REQUIRE_AUTH:-true}"
CONTENT_ADMIN_ALLOW_LEGACY_ROLE_HEADER="${CONTENT_ADMIN_ALLOW_LEGACY_ROLE_HEADER:-false}"
CONTENT_ADMIN_SMOKE_BEARER="${CONTENT_ADMIN_SMOKE_BEARER:-}"
CONTENT_ADMIN_SMOKE_LOGIN_ID="${CONTENT_ADMIN_SMOKE_LOGIN_ID:-}"
CONTENT_ADMIN_SMOKE_PASSWORD="${CONTENT_ADMIN_SMOKE_PASSWORD:-}"

if [[ "${CONTENT_ADMIN_REQUIRE_AUTH}" == "true" && -z "${CONTENT_ADMIN_SMOKE_BEARER}" && -n "${CONTENT_ADMIN_SMOKE_LOGIN_ID}" && -n "${CONTENT_ADMIN_SMOKE_PASSWORD}" ]]; then
  token_payload="$(curl -fsS -X POST "${BASE_URL}/auth/login" \
    -H "content-type: application/json" \
    -d "{\"loginId\":\"${CONTENT_ADMIN_SMOKE_LOGIN_ID}\",\"password\":\"${CONTENT_ADMIN_SMOKE_PASSWORD}\"}" || true)"
  if [[ -n "${token_payload}" ]]; then
    CONTENT_ADMIN_SMOKE_BEARER="$(node -e "const p=JSON.parse(process.argv[1]||'{}'); process.stdout.write(String(p.token||''));" "${token_payload}" || true)"
  fi
fi

echo "[smoke-content] health"
curl -fsS "${BASE_URL}/health" >/dev/null

echo "[smoke-content] fetch public discover feed"
curl -fsS "${BASE_URL}/content/discover?lang=ko&limit=5" >/dev/null

if [[ "${CONTENT_ADMIN_REQUIRE_AUTH}" == "true" ]]; then
  if [[ -n "${CONTENT_ADMIN_SMOKE_BEARER}" ]]; then
    echo "[smoke-content] fetch admin items with bearer token"
    curl -fsS -H "authorization: Bearer ${CONTENT_ADMIN_SMOKE_BEARER}" "${BASE_URL}/content/admin/items" >/dev/null
  else
    echo "[smoke-content] skip admin read smoke (CONTENT_ADMIN_SMOKE_BEARER is not set)"
  fi
elif [[ "${CONTENT_ADMIN_ALLOW_LEGACY_ROLE_HEADER}" == "true" ]]; then
  echo "[smoke-content] fetch admin items as viewer (legacy role header)"
  curl -fsS -H "x-admin-role: viewer" "${BASE_URL}/content/admin/items" >/dev/null
else
  echo "[smoke-content] skip admin read smoke (legacy role header disabled)"
fi

echo "[smoke-content] post click log"
curl -fsS -X POST "${BASE_URL}/content/discover/click" \
  -H "content-type: application/json" \
  -d '{"itemId":"smoke-item","itemTitle":"Smoke Item","category":"featured","section":"feature","declaredActionType":"external","resolvedActionType":"external","internalTarget":"","externalUrl":"https://www.coingecko.com","success":true,"reason":"smoke","platform":"web","lang":"ko","walletId":"smoke-wallet"}' >/dev/null

if [[ "${CONTENT_ADMIN_REQUIRE_AUTH}" == "true" ]]; then
  if [[ -n "${CONTENT_ADMIN_SMOKE_BEARER}" ]]; then
    echo "[smoke-content] click summary with bearer token"
    curl -fsS -H "authorization: Bearer ${CONTENT_ADMIN_SMOKE_BEARER}" "${BASE_URL}/content/admin/clicks/summary?days=7" >/dev/null
  else
    echo "[smoke-content] skip admin summary smoke (CONTENT_ADMIN_SMOKE_BEARER is not set)"
  fi
elif [[ "${CONTENT_ADMIN_ALLOW_LEGACY_ROLE_HEADER}" == "true" ]]; then
  echo "[smoke-content] click summary as compliance (legacy role header)"
  curl -fsS -H "x-admin-role: compliance" "${BASE_URL}/content/admin/clicks/summary?days=7" >/dev/null
else
  echo "[smoke-content] skip admin summary smoke (legacy role header disabled)"
fi

echo "[smoke-content] done"
