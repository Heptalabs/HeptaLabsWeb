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

TIMEOUT="${CHECK_TIMEOUT_SECONDS:-8}"
CHECK_RETRY_COUNT="${CHECK_RETRY_COUNT:-3}"
CHECK_RETRY_DELAY_MS="${CHECK_RETRY_DELAY_MS:-800}"
FAIL_COUNT=0

if ! [[ "${CHECK_RETRY_COUNT}" =~ ^[0-9]+$ ]] || [[ "${CHECK_RETRY_COUNT}" -lt 1 ]]; then
  CHECK_RETRY_COUNT=3
fi
if ! [[ "${CHECK_RETRY_DELAY_MS}" =~ ^[0-9]+$ ]] || [[ "${CHECK_RETRY_DELAY_MS}" -lt 0 ]]; then
  CHECK_RETRY_DELAY_MS=800
fi
CHECK_RETRY_DELAY_SEC="$(awk "BEGIN { printf \"%.3f\", ${CHECK_RETRY_DELAY_MS} / 1000 }")"

check_public_json() {
  local name="$1"
  local url="$2"
  local attempt
  local status
  for attempt in $(seq 1 "${CHECK_RETRY_COUNT}"); do
    status="$(curl -sS --max-time "${TIMEOUT}" -o /tmp/imwallet-provider-${name}.json -w "%{http_code}" "${url}" || true)"
    if [[ "${status}" == "200" ]]; then
      echo "[ok] ${name}"
      return 0
    fi

    if [[ "${status}" == "429" ]]; then
      if [[ "${REQUIRE_RECOMMENDED}" == "1" ]]; then
        echo "[fail] ${name} rate-limited (429, strict mode)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        return 1
      fi
      echo "[warn] ${name} rate-limited (429), allow in non-strict mode"
      return 0
    fi

    if [[ "${attempt}" -lt "${CHECK_RETRY_COUNT}" ]]; then
      sleep "${CHECK_RETRY_DELAY_SEC}"
    fi
  done

  echo "[fail] ${name} (${url}) status=${status:-unknown}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

check_keyed_json() {
  local name="$1"
  local url="$2"
  local header_name="$3"
  local header_value="$4"
  local required="${5:-0}"

  if [[ -z "${header_value}" ]]; then
    echo "[warn] ${name} key missing, skip keyed check"
    if [[ "${required}" == "1" ]]; then
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    return 0
  fi

  if curl -fsS --max-time "${TIMEOUT}" -H "${header_name}: ${header_value}" "${url}" >/dev/null; then
    echo "[ok] ${name} (keyed)"
  else
    echo "[fail] ${name} keyed request failed"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

resolve_dappradar_url() {
  local endpoint="${DAPPRADAR_TOP_DAPPS_ENDPOINT:-}"
  if [[ -n "${endpoint}" ]]; then
    printf '%s\n' "${endpoint}"
    return 0
  fi

  local base_url="${DAPPRADAR_BASE_URL:-https://apis.dappradar.com}"
  local project_id="${DAPPRADAR_PROJECT_ID:-}"
  local top_path="${DAPPRADAR_TOP_DAPPS_PATH:-dapps/top/uaw}"
  local top_range="${DAPPRADAR_TOP_RANGE:-30d}"
  local limit_param="${DAPPRADAR_TOP_LIMIT_PARAM:-top}"

  if [[ -z "${project_id}" ]]; then
    return 1
  fi

  base_url="${base_url%/}"
  top_path="${top_path#/}"
  top_path="${top_path%/}"
  printf '%s/%s/%s?range=%s&%s=10\n' "${base_url}" "${project_id}" "${top_path}" "${top_range}" "${limit_param}"
}

check_dappradar_top_dapps() {
  local api_key="${DAPPRADAR_API_KEY:-}"
  local auth_header="${DAPPRADAR_AUTH_HEADER:-X-BLOBR-KEY}"
  local auth_prefix="${DAPPRADAR_AUTH_PREFIX:-}"
  local url

  if ! url="$(resolve_dappradar_url)"; then
    echo "[warn] dappradar endpoint not configured (set DAPPRADAR_TOP_DAPPS_ENDPOINT or DAPPRADAR_PROJECT_ID)"
    if [[ "${REQUIRE_RECOMMENDED}" == "1" ]]; then
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    return 0
  fi

  if [[ -z "${api_key}" ]]; then
    echo "[warn] dappradar api key missing, skip keyed check"
    if [[ "${REQUIRE_RECOMMENDED}" == "1" ]]; then
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    return 0
  fi

  local header_value="${api_key}"
  if [[ -n "${auth_prefix}" ]]; then
    header_value="${auth_prefix} ${api_key}"
  fi

  local status
  status="$(curl -sS --max-time "${TIMEOUT}" -o /tmp/imwallet-provider-dappradar.json -w "%{http_code}" -H "${auth_header}: ${header_value}" "${url}" || true)"
  if [[ "${status}" == "200" ]]; then
    echo "[ok] dappradar-top-dapps (keyed)"
    return 0
  fi

  echo "[fail] dappradar-top-dapps keyed request failed status=${status:-unknown}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

echo "[check-provider-connectivity] env file: ${ENV_FILE}"
if [[ -n "${ENV_KEYS_FILE}" ]]; then
  echo "[check-provider-connectivity] env keys file: ${ENV_KEYS_FILE}"
fi

# Core market/fallback providers used in backend holder/price paths
check_public_json "coingecko" "https://api.coingecko.com/api/v3/ping"
check_public_json "coinone" "https://api.coinone.co.kr/public/v2/ticker_new/KRW/BTC"
check_public_json "ethplorer" "https://api.ethplorer.io/getTokenInfo/0xdAC17F958D2ee523a2206206994597C13D831ec7?apiKey=freekey"
check_public_json "coincarp-holders" "https://sapi.coincarp.com/api/v1/market/chain/holdersummary?code=solana&platform="
check_public_json "tronscan-token" "https://apilist.tronscanapi.com/api/token_trc20?contract=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
check_public_json "filfox-overview" "https://filfox.info/api/v1/overview"
check_public_json "coinmetrics-community" "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=AdrBalCnt&frequency=1d&page_size=1"

# Keyed providers
check_keyed_json \
  "coinmarketcap-pro" \
  "https://pro-api.coinmarketcap.com/v1/key/info" \
  "X-CMC_PRO_API_KEY" \
  "${COINMARKETCAP_API_KEY:-}" \
  "${REQUIRE_RECOMMENDED}"

check_dappradar_top_dapps

if [[ -n "${ETHERSCAN_API_KEY:-}" ]]; then
  check_public_json \
    "etherscan-tokenholdercount" \
    "https://api.etherscan.io/v2/api?chainid=1&module=token&action=tokenholdercount&contractaddress=0xdAC17F958D2ee523a2206206994597C13D831ec7&apikey=${ETHERSCAN_API_KEY}"
else
  if [[ "${REQUIRE_RECOMMENDED}" == "1" ]]; then
    echo "[fail] etherscan key missing (strict mode)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    echo "[warn] etherscan key missing, backend will use ethplorer/html fallback"
  fi
fi

if [[ -n "${TRONSCAN_API_KEY:-}" ]]; then
  if curl -fsS --max-time "${TIMEOUT}" \
    -H "TRON-PRO-API-KEY: ${TRONSCAN_API_KEY}" \
    "https://apilist.tronscanapi.com/api/account/list?start=0&limit=1&sort=-balance" >/dev/null; then
    echo "[ok] tronscan-account-list (keyed)"
  else
    echo "[fail] tronscan-account-list (keyed)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  if [[ "${REQUIRE_RECOMMENDED}" == "1" ]]; then
    echo "[fail] tronscan key missing (strict mode)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    echo "[warn] tronscan key missing, backend will use public tronscan endpoints"
  fi
fi

if [[ -n "${SOLSCAN_API_KEY:-}" ]]; then
  if curl -fsS --max-time "${TIMEOUT}" \
    -H "token: ${SOLSCAN_API_KEY}" \
    "https://pro-api.solscan.io/v2.0/account/total" >/dev/null; then
    echo "[ok] solscan-pro (keyed)"
  else
    echo "[fail] solscan-pro (keyed)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  if [[ "${REQUIRE_RECOMMENDED}" == "1" ]]; then
    echo "[fail] solscan key missing (strict mode)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    echo "[warn] solscan key missing, backend will use coincarp fallback for SOL holder count"
  fi
fi

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  echo "[check-provider-connectivity] failed=${FAIL_COUNT}"
  exit 1
fi

echo "[check-provider-connectivity] done"
