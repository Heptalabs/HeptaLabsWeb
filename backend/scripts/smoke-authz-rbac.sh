#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:4000/api/v1}"
CONTENT_ADMIN_REQUIRE_AUTH="${CONTENT_ADMIN_REQUIRE_AUTH:-true}"
CONTENT_ADMIN_ALLOW_LEGACY_ROLE_HEADER="${CONTENT_ADMIN_ALLOW_LEGACY_ROLE_HEADER:-false}"
SMOKE_LOGIN_ID="${CONTENT_ADMIN_SMOKE_LOGIN_ID:-}"
SMOKE_PASSWORD="${CONTENT_ADMIN_SMOKE_PASSWORD:-}"
SMOKE_TOKEN="${CONTENT_ADMIN_SMOKE_BEARER:-}"

echo "[smoke-authz-rbac] base=${BASE_URL}"

if [[ "${CONTENT_ADMIN_REQUIRE_AUTH}" == "true" ]]; then
  status_no_token="$(curl -s -o /tmp/imwallet-authz-no-token.json -w "%{http_code}" "${BASE_URL}/content/admin/items" || true)"
  if [[ "${status_no_token}" != "401" ]]; then
    echo "[fail] expected 401 without token, got ${status_no_token}"
    exit 1
  fi
  echo "[ok] unauthorized request blocked (401)"

  if [[ -z "${SMOKE_TOKEN}" && -n "${SMOKE_LOGIN_ID}" && -n "${SMOKE_PASSWORD}" ]]; then
    login_payload="$(curl -fsS -X POST "${BASE_URL}/auth/login" \
      -H "content-type: application/json" \
      -d "{\"loginId\":\"${SMOKE_LOGIN_ID}\",\"password\":\"${SMOKE_PASSWORD}\"}")"
    SMOKE_TOKEN="$(node -e "const p=JSON.parse(process.argv[1]||'{}'); process.stdout.write(String(p.token||''));" "${login_payload}")"
  fi

  if [[ -z "${SMOKE_TOKEN}" ]]; then
    echo "[warn] token smoke skipped (set CONTENT_ADMIN_SMOKE_BEARER or login credentials)"
    echo "[smoke-authz-rbac] done (partial)"
    exit 0
  fi

  status_with_token="$(curl -s -o /tmp/imwallet-authz-with-token.json -w "%{http_code}" \
    -H "authorization: Bearer ${SMOKE_TOKEN}" \
    "${BASE_URL}/content/admin/items" || true)"
  if [[ "${status_with_token}" != "200" ]]; then
    echo "[fail] expected 200 with token, got ${status_with_token}"
    exit 1
  fi
  echo "[ok] authorized content-admin read (200)"
else
  if [[ "${CONTENT_ADMIN_ALLOW_LEGACY_ROLE_HEADER}" == "true" ]]; then
    status_viewer="$(curl -s -o /tmp/imwallet-authz-viewer.json -w "%{http_code}" \
      -H "x-admin-role: viewer" \
      "${BASE_URL}/content/admin/items" || true)"
    if [[ "${status_viewer}" != "200" ]]; then
      echo "[fail] expected 200 for legacy viewer, got ${status_viewer}"
      exit 1
    fi
    echo "[ok] legacy viewer content-admin read (200)"
  else
    echo "[warn] auth disabled but legacy role header is also disabled; authz smoke skipped"
  fi
fi

echo "[smoke-authz-rbac] done"
