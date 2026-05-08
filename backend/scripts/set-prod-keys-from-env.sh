#!/usr/bin/env bash
set -euo pipefail

OUTPUT_FILE="${1:-.env.production.keys}"

required_keys=(
  "COINMARKETCAP_API_KEY"
  "DAPPRADAR_API_KEY"
  "COINMETRICS_API_KEY"
  "ETHERSCAN_API_KEY"
  "TRONSCAN_API_KEY"
  "SOLSCAN_API_KEY"
)

shell_quote() {
  local raw="$1"
  local escaped
  escaped="$(printf '%s' "${raw}" | sed "s/'/'\"'\"'/g")"
  printf "'%s'" "${escaped}"
}

missing=0
for key in "${required_keys[@]}"; do
  value="${!key:-}"
  if [[ -z "${value}" ]]; then
    echo "[fail] missing env: ${key}"
    missing=$((missing + 1))
  fi
done

if [[ "${missing}" -gt 0 ]]; then
  echo "[set-prod-keys-from-env] failed (missing: ${missing})"
  echo "export required env vars first, then run again."
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  ts="$(date +%Y%m%d-%H%M%S)"
  cp "${OUTPUT_FILE}" "${OUTPUT_FILE}.bak.${ts}"
  echo "[set-prod-keys-from-env] backup created: ${OUTPUT_FILE}.bak.${ts}"
fi

{
  printf "COINMARKETCAP_API_KEY=%s\n" "$(shell_quote "${COINMARKETCAP_API_KEY}")"
  printf "DAPPRADAR_API_KEY=%s\n" "$(shell_quote "${DAPPRADAR_API_KEY}")"
  printf "COINMETRICS_API_KEY=%s\n" "$(shell_quote "${COINMETRICS_API_KEY}")"
  printf "ETHERSCAN_API_KEY=%s\n" "$(shell_quote "${ETHERSCAN_API_KEY}")"
  printf "TRONSCAN_API_KEY=%s\n" "$(shell_quote "${TRONSCAN_API_KEY}")"
  printf "SOLSCAN_API_KEY=%s\n" "$(shell_quote "${SOLSCAN_API_KEY}")"
} > "${OUTPUT_FILE}"

chmod 600 "${OUTPUT_FILE}"
echo "[set-prod-keys-from-env] wrote ${OUTPUT_FILE} (mode 600)"
