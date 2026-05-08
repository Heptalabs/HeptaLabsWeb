#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"
ENV_KEYS_FILE="${ENV_KEYS_FILE:-}"
REQUIRE_RECOMMENDED="${REQUIRE_RECOMMENDED:-0}"

if ! [[ "${REQUIRE_RECOMMENDED}" =~ ^[01]$ ]]; then
  REQUIRE_RECOMMENDED=0
fi

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a && source "${ENV_FILE}" && set +a
fi

if [[ -z "${ENV_KEYS_FILE}" && "${ENV_FILE}" == ".env.production" && -f ".env.production.keys" ]]; then
  ENV_KEYS_FILE=".env.production.keys"
fi

if [[ -n "${ENV_KEYS_FILE}" && -f "${ENV_KEYS_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a && source "${ENV_KEYS_FILE}" && set +a
fi

REQUIRED_VARS=(
  "DATABASE_URL"
  "JWT_SECRET"
)

RECOMMENDED_VARS=(
  "CORS_ALLOWED_ORIGINS"
  "CONTENT_ADMIN_REQUIRE_AUTH"
  "COINMARKETCAP_API_KEY"
  "DAPPRADAR_API_KEY"
  "DAPPRADAR_PROJECT_ID"
  "ETHERSCAN_API_KEY"
  "TRONSCAN_API_KEY"
  "COINMETRICS_API_KEY"
  "SOLSCAN_API_KEY"
)

missing_required=0
missing_recommended=0

echo "[check-prod-env] env file: ${ENV_FILE}"
if [[ -n "${ENV_KEYS_FILE}" ]]; then
  echo "[check-prod-env] env keys file: ${ENV_KEYS_FILE}"
fi

for name in "${REQUIRED_VARS[@]}"; do
  value="${!name:-}"
  if [[ -z "${value}" ]]; then
    echo "[fail] required env missing: ${name}"
    missing_required=$((missing_required + 1))
  else
    echo "[ok] required env set: ${name}"
  fi
done

for name in "${RECOMMENDED_VARS[@]}"; do
  value="${!name:-}"
  if [[ -z "${value}" ]]; then
    echo "[warn] recommended env missing: ${name}"
    missing_recommended=$((missing_recommended + 1))
  else
    echo "[ok] recommended env set: ${name}"
  fi
done

node_env="${NODE_ENV:-}"
if [[ "${node_env}" != "production" ]]; then
  echo "[warn] NODE_ENV is '${node_env:-<empty>}' (expected: production)"
else
  echo "[ok] NODE_ENV=production"
fi

discover_https="${DISCOVER_ENFORCE_HTTPS:-}"
if [[ "${discover_https}" != "true" ]]; then
  echo "[warn] DISCOVER_ENFORCE_HTTPS is '${discover_https:-<empty>}' (recommended: true in production)"
else
  echo "[ok] DISCOVER_ENFORCE_HTTPS=true"
fi

dappradar_endpoint="${DAPPRADAR_TOP_DAPPS_ENDPOINT:-}"
dappradar_project_id="${DAPPRADAR_PROJECT_ID:-}"
if [[ -z "${dappradar_endpoint}" && -z "${dappradar_project_id}" ]]; then
  echo "[warn] DAPPRADAR endpoint config missing (set DAPPRADAR_TOP_DAPPS_ENDPOINT or DAPPRADAR_PROJECT_ID)"
  if [[ "${REQUIRE_RECOMMENDED}" == "1" ]]; then
    missing_recommended=$((missing_recommended + 1))
  fi
else
  echo "[ok] DAPPRADAR endpoint config present"
fi

content_admin_require_auth="${CONTENT_ADMIN_REQUIRE_AUTH:-}"
if [[ "${content_admin_require_auth}" != "true" ]]; then
  echo "[warn] CONTENT_ADMIN_REQUIRE_AUTH is '${content_admin_require_auth:-<empty>}' (recommended: true in production)"
else
  echo "[ok] CONTENT_ADMIN_REQUIRE_AUTH=true"
fi

legacy_content_header="${CONTENT_ADMIN_ALLOW_LEGACY_ROLE_HEADER:-}"
if [[ "${legacy_content_header}" == "true" ]]; then
  echo "[warn] CONTENT_ADMIN_ALLOW_LEGACY_ROLE_HEADER=true (recommended: false in production)"
else
  echo "[ok] legacy content role header disabled"
fi

jwt_secret="${JWT_SECRET:-}"
jwt_len="${#jwt_secret}"
if [[ -n "${jwt_secret}" && "${jwt_len}" -lt 32 ]]; then
  echo "[warn] JWT_SECRET length is ${jwt_len} (recommended: 32+)"
elif [[ -n "${jwt_secret}" ]]; then
  echo "[ok] JWT_SECRET length looks strong (${jwt_len})"
fi

if [[ "${missing_required}" -gt 0 ]]; then
  echo "[check-prod-env] failed (missing required: ${missing_required})"
  exit 1
fi

if [[ "${REQUIRE_RECOMMENDED}" == "1" && "${missing_recommended}" -gt 0 ]]; then
  echo "[check-prod-env] failed (strict mode, missing recommended: ${missing_recommended})"
  exit 1
fi

echo "[check-prod-env] done (recommended missing: ${missing_recommended})"
