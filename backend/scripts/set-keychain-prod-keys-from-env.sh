#!/usr/bin/env bash
set -euo pipefail

required_keys=(
  "COINMARKETCAP_API_KEY"
  "DAPPRADAR_API_KEY"
  "COINMETRICS_API_KEY"
  "ETHERSCAN_API_KEY"
  "TRONSCAN_API_KEY"
  "SOLSCAN_API_KEY"
)

if ! command -v security >/dev/null 2>&1; then
  echo "[fail] macOS security command not found"
  exit 1
fi

missing=0
for key in "${required_keys[@]}"; do
  value="${!key:-}"
  if [[ -z "${value}" ]]; then
    echo "[fail] missing env: ${key}"
    missing=$((missing + 1))
  fi
done

if [[ "${missing}" -gt 0 ]]; then
  echo "[set-keychain-prod-keys-from-env] failed (missing: ${missing})"
  echo "export required env vars first, then run again."
  exit 1
fi

security add-generic-password -a "${USER}" -s IMWALLET_COINMARKETCAP_API_KEY -w "${COINMARKETCAP_API_KEY}" -U >/dev/null
security add-generic-password -a "${USER}" -s IMWALLET_DAPPRADAR_API_KEY -w "${DAPPRADAR_API_KEY}" -U >/dev/null
security add-generic-password -a "${USER}" -s IMWALLET_COINMETRICS_API_KEY -w "${COINMETRICS_API_KEY}" -U >/dev/null
security add-generic-password -a "${USER}" -s IMWALLET_ETHERSCAN_API_KEY -w "${ETHERSCAN_API_KEY}" -U >/dev/null
security add-generic-password -a "${USER}" -s IMWALLET_TRONSCAN_API_KEY -w "${TRONSCAN_API_KEY}" -U >/dev/null
security add-generic-password -a "${USER}" -s IMWALLET_SOLSCAN_API_KEY -w "${SOLSCAN_API_KEY}" -U >/dev/null

echo "[set-keychain-prod-keys-from-env] keychain update completed"
echo "run: npm run set:prod-keys:keychain"
