#!/usr/bin/env bash
set -euo pipefail

OUTPUT_FILE="${1:-.env.production.keys}"

if [[ -f "${OUTPUT_FILE}" ]]; then
  ts="$(date +%Y%m%d-%H%M%S)"
  cp "${OUTPUT_FILE}" "${OUTPUT_FILE}.bak.${ts}"
  echo "[set-prod-keys] backup created: ${OUTPUT_FILE}.bak.${ts}"
fi

read -rsp "COINMARKETCAP_API_KEY: " COINMARKETCAP_API_KEY; echo
read -rsp "DAPPRADAR_API_KEY: " DAPPRADAR_API_KEY; echo
read -rsp "COINMETRICS_API_KEY: " COINMETRICS_API_KEY; echo
read -rsp "ETHERSCAN_API_KEY: " ETHERSCAN_API_KEY; echo
read -rsp "TRONSCAN_API_KEY: " TRONSCAN_API_KEY; echo
read -rsp "SOLSCAN_API_KEY: " SOLSCAN_API_KEY; echo

cat > "${OUTPUT_FILE}" <<KEYS
COINMARKETCAP_API_KEY=${COINMARKETCAP_API_KEY}
DAPPRADAR_API_KEY=${DAPPRADAR_API_KEY}
COINMETRICS_API_KEY=${COINMETRICS_API_KEY}
ETHERSCAN_API_KEY=${ETHERSCAN_API_KEY}
TRONSCAN_API_KEY=${TRONSCAN_API_KEY}
SOLSCAN_API_KEY=${SOLSCAN_API_KEY}
KEYS

chmod 600 "${OUTPUT_FILE}"
echo "[set-prod-keys] wrote ${OUTPUT_FILE} (mode 600)"
