#!/usr/bin/env bash
set -euo pipefail

OUTPUT_FILE="${1:-.env.production.keys}"

load_keychain_value() {
  local env_name="$1"
  local service_name="$2"
  local value
  if ! value="$(security find-generic-password -s "${service_name}" -w 2>/dev/null)"; then
    echo "[fail] keychain item missing: ${service_name}" >&2
    return 1
  fi
  if [[ -z "${value}" ]]; then
    echo "[fail] keychain item missing: ${service_name}" >&2
    return 1
  fi
  printf '%s' "${value}"
}

shell_quote() {
  local raw="$1"
  local escaped
  escaped="$(printf '%s' "${raw}" | sed "s/'/'\"'\"'/g")"
  printf "'%s'" "${escaped}"
}

if ! command -v security >/dev/null 2>&1; then
  echo "[fail] macOS security command not found"
  exit 1
fi

missing=0

if COINMARKETCAP_API_KEY_VALUE="$(load_keychain_value "COINMARKETCAP_API_KEY" "IMWALLET_COINMARKETCAP_API_KEY")"; then
  echo "[ok] loaded: COINMARKETCAP_API_KEY <- IMWALLET_COINMARKETCAP_API_KEY"
else
  COINMARKETCAP_API_KEY_VALUE=""
  missing=$((missing + 1))
fi

if DAPPRADAR_API_KEY_VALUE="$(load_keychain_value "DAPPRADAR_API_KEY" "IMWALLET_DAPPRADAR_API_KEY")"; then
  echo "[ok] loaded: DAPPRADAR_API_KEY <- IMWALLET_DAPPRADAR_API_KEY"
else
  DAPPRADAR_API_KEY_VALUE=""
  missing=$((missing + 1))
fi

if COINMETRICS_API_KEY_VALUE="$(load_keychain_value "COINMETRICS_API_KEY" "IMWALLET_COINMETRICS_API_KEY")"; then
  echo "[ok] loaded: COINMETRICS_API_KEY <- IMWALLET_COINMETRICS_API_KEY"
else
  COINMETRICS_API_KEY_VALUE=""
  missing=$((missing + 1))
fi

if ETHERSCAN_API_KEY_VALUE="$(load_keychain_value "ETHERSCAN_API_KEY" "IMWALLET_ETHERSCAN_API_KEY")"; then
  echo "[ok] loaded: ETHERSCAN_API_KEY <- IMWALLET_ETHERSCAN_API_KEY"
else
  ETHERSCAN_API_KEY_VALUE=""
  missing=$((missing + 1))
fi

if TRONSCAN_API_KEY_VALUE="$(load_keychain_value "TRONSCAN_API_KEY" "IMWALLET_TRONSCAN_API_KEY")"; then
  echo "[ok] loaded: TRONSCAN_API_KEY <- IMWALLET_TRONSCAN_API_KEY"
else
  TRONSCAN_API_KEY_VALUE=""
  missing=$((missing + 1))
fi

if SOLSCAN_API_KEY_VALUE="$(load_keychain_value "SOLSCAN_API_KEY" "IMWALLET_SOLSCAN_API_KEY")"; then
  echo "[ok] loaded: SOLSCAN_API_KEY <- IMWALLET_SOLSCAN_API_KEY"
else
  SOLSCAN_API_KEY_VALUE=""
  missing=$((missing + 1))
fi

if [[ "${missing}" -gt 0 ]]; then
  echo "[set-prod-keys-from-keychain] failed (missing: ${missing})"
  echo "[hint] create keychain items with:"
  echo "       security add-generic-password -a \"\$USER\" -s IMWALLET_COINMARKETCAP_API_KEY -w \"<value>\" -U"
  echo "       security add-generic-password -a \"\$USER\" -s IMWALLET_DAPPRADAR_API_KEY -w \"<value>\" -U"
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  ts="$(date +%Y%m%d-%H%M%S)"
  cp "${OUTPUT_FILE}" "${OUTPUT_FILE}.bak.${ts}"
  echo "[set-prod-keys-from-keychain] backup created: ${OUTPUT_FILE}.bak.${ts}"
fi

{
  printf "COINMARKETCAP_API_KEY=%s\n" "$(shell_quote "${COINMARKETCAP_API_KEY_VALUE}")"
  printf "DAPPRADAR_API_KEY=%s\n" "$(shell_quote "${DAPPRADAR_API_KEY_VALUE}")"
  printf "COINMETRICS_API_KEY=%s\n" "$(shell_quote "${COINMETRICS_API_KEY_VALUE}")"
  printf "ETHERSCAN_API_KEY=%s\n" "$(shell_quote "${ETHERSCAN_API_KEY_VALUE}")"
  printf "TRONSCAN_API_KEY=%s\n" "$(shell_quote "${TRONSCAN_API_KEY_VALUE}")"
  printf "SOLSCAN_API_KEY=%s\n" "$(shell_quote "${SOLSCAN_API_KEY_VALUE}")"
} > "${OUTPUT_FILE}"

chmod 600 "${OUTPUT_FILE}"
echo "[set-prod-keys-from-keychain] wrote ${OUTPUT_FILE} (mode 600)"
