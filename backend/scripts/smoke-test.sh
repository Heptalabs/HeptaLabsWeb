#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000/api/v1}"
TS="$(date +%s)"

MEMBER_LOGIN_ID="${MEMBER_LOGIN_ID:-member_${TS}}"
MEMBER_PASSWORD="${MEMBER_PASSWORD:-Aa!12345}"
MEMBER_NAME="${MEMBER_NAME:-Member Demo}"
MEMBER_PHONE="${MEMBER_PHONE:-01011112222}"
MEMBER_EMAIL="${MEMBER_EMAIL:-member_${TS}@example.com}"

ADMIN_LOGIN_ID="${ADMIN_LOGIN_ID:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[error] missing required command: $1" >&2
    exit 1
  }
}

require_cmd curl
require_cmd python3

json_get() {
  local key="$1"
  python3 - "$key" <<'PY'
import json, sys
key = sys.argv[1]
try:
    data = json.load(sys.stdin)
except Exception:
    print("")
    raise SystemExit(0)

cur = data
for part in key.split('.'):
    if isinstance(cur, dict) and part in cur:
        cur = cur[part]
    else:
        print("")
        raise SystemExit(0)
print(cur if cur is not None else "")
PY
}

make_idempotency_key() {
  local prefix="$1"
  python3 - "$prefix" <<'PY'
import sys, uuid
print(f"{sys.argv[1]}-{uuid.uuid4()}")
PY
}

HTTP_STATUS=""
HTTP_BODY=""

request_json() {
  local method="$1"
  local url="$2"
  local body_file="$3"
  shift 3

  local output_file="$TMP_DIR/resp.txt"
  local code

  if [[ -f "$body_file" ]]; then
    code=$(curl -sS -o "$output_file" -w "%{http_code}" -X "$method" "$url" "$@" --data @"$body_file")
  else
    code=$(curl -sS -o "$output_file" -w "%{http_code}" -X "$method" "$url" "$@")
  fi

  HTTP_STATUS="$code"
  HTTP_BODY="$(cat "$output_file")"
}

expect_status() {
  local expected="$1"
  if [[ "$HTTP_STATUS" != "$expected" ]]; then
    echo "[error] expected status $expected but got $HTTP_STATUS" >&2
    echo "[error] body: $HTTP_BODY" >&2
    exit 1
  fi
}

expect_status_one_of() {
  local ok="false"
  for status in "$@"; do
    if [[ "$HTTP_STATUS" == "$status" ]]; then
      ok="true"
      break
    fi
  done

  if [[ "$ok" != "true" ]]; then
    echo "[error] expected one of: $* but got $HTTP_STATUS" >&2
    echo "[error] body: $HTTP_BODY" >&2
    exit 1
  fi
}

echo "[step] health check"
request_json GET "$BASE_URL/health" /dev/null
expect_status 200

echo "[step] signup (or already exists)"
cat >"$TMP_DIR/signup.json" <<JSON
{
  "loginId": "$MEMBER_LOGIN_ID",
  "password": "$MEMBER_PASSWORD",
  "name": "$MEMBER_NAME",
  "phone": "$MEMBER_PHONE",
  "email": "$MEMBER_EMAIL"
}
JSON
request_json POST "$BASE_URL/auth/signup" "$TMP_DIR/signup.json" -H "Content-Type: application/json"
expect_status_one_of 201 409

echo "[step] login member"
cat >"$TMP_DIR/member-login.json" <<JSON
{
  "loginId": "$MEMBER_LOGIN_ID",
  "password": "$MEMBER_PASSWORD"
}
JSON
request_json POST "$BASE_URL/auth/login" "$TMP_DIR/member-login.json" -H "Content-Type: application/json"
expect_status 200
MEMBER_TOKEN="$(printf '%s' "$HTTP_BODY" | json_get token)"
if [[ -z "$MEMBER_TOKEN" ]]; then
  echo "[error] member token not found" >&2
  exit 1
fi

echo "[step] get me"
request_json GET "$BASE_URL/me" /dev/null -H "Authorization: Bearer $MEMBER_TOKEN"
expect_status 200
MEMBER_UID="$(printf '%s' "$HTTP_BODY" | json_get uid)"
echo "[ok] logged in member uid=$MEMBER_UID"

echo "[step] list products"
request_json GET "$BASE_URL/products" /dev/null -H "Authorization: Bearer $MEMBER_TOKEN"
expect_status 200
FIRST_PRODUCT_ID="$(printf '%s' "$HTTP_BODY" | python3 - <<'PY'
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    print("")
    raise SystemExit(0)
items = data.get("items") or []
print(items[0].get("id") if items else "")
PY
)"

echo "[step] create deposit request"
DEPOSIT_KEY="$(make_idempotency_key dep)"
cat >"$TMP_DIR/deposit.json" <<JSON
{
  "network": "TRC20",
  "amount": "100.000000",
  "txid": "TX${TS}ABC",
  "proofNote": "smoke-test"
}
JSON
request_json POST "$BASE_URL/deposits" "$TMP_DIR/deposit.json" \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: $DEPOSIT_KEY"
expect_status 201
DEPOSIT_ID="$(printf '%s' "$HTTP_BODY" | json_get id)"
echo "[ok] deposit_id=$DEPOSIT_ID"

echo "[step] list deposits"
request_json GET "$BASE_URL/deposits" /dev/null -H "Authorization: Bearer $MEMBER_TOKEN"
expect_status 200

echo "[step] list subscriptions"
request_json GET "$BASE_URL/subscriptions" /dev/null -H "Authorization: Bearer $MEMBER_TOKEN"
expect_status 200

echo "[step] list withdrawals"
request_json GET "$BASE_URL/withdrawals" /dev/null -H "Authorization: Bearer $MEMBER_TOKEN"
expect_status 200

if [[ -n "$ADMIN_PASSWORD" ]]; then
  echo "[step] login admin"
  cat >"$TMP_DIR/admin-login.json" <<JSON
{
  "loginId": "$ADMIN_LOGIN_ID",
  "password": "$ADMIN_PASSWORD"
}
JSON
  request_json POST "$BASE_URL/auth/login" "$TMP_DIR/admin-login.json" -H "Content-Type: application/json"
  expect_status 200
  ADMIN_TOKEN="$(printf '%s' "$HTTP_BODY" | json_get token)"

  echo "[step] approve deposit as admin"
  cat >"$TMP_DIR/approve-deposit.json" <<JSON
{
  "decision": "APPROVED",
  "adminMemo": "approved by smoke-test"
}
JSON
  request_json POST "$BASE_URL/admin/deposits/$DEPOSIT_ID/decision" "$TMP_DIR/approve-deposit.json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json"
  expect_status 200

  if [[ -n "$FIRST_PRODUCT_ID" ]]; then
    echo "[step] create subscription (post deposit approval)"
    cat >"$TMP_DIR/subscription.json" <<JSON
{
  "amount": "50.000000",
  "idempotencyKey": "$(make_idempotency_key sub)"
}
JSON
    request_json POST "$BASE_URL/products/$FIRST_PRODUCT_ID/subscriptions" "$TMP_DIR/subscription.json" \
      -H "Authorization: Bearer $MEMBER_TOKEN" \
      -H "Content-Type: application/json"

    if [[ "$HTTP_STATUS" == "201" ]]; then
      echo "[ok] subscription created"
    else
      echo "[warn] subscription request returned status=$HTTP_STATUS body=$HTTP_BODY"
    fi
  fi

  echo "[step] run admin batch"
  cat >"$TMP_DIR/run-batch.json" <<JSON
{
  "businessDate": "$(date +%F)"
}
JSON
  request_json POST "$BASE_URL/admin/batch/run" "$TMP_DIR/run-batch.json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json"
  expect_status 200
  echo "[ok] batch run response: $HTTP_BODY"
else
  echo "[info] ADMIN_PASSWORD is empty; skipping admin approval and batch steps."
fi

echo "[done] smoke test completed"
