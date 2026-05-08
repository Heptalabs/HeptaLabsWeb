#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:4000/api/v1}"
REQUIRE_SOL_HOLDER="${REQUIRE_SOL_HOLDER:-0}"
REQUIRE_USDT_BSC_HOLDER="${REQUIRE_USDT_BSC_HOLDER:-0}"
SMOKE_RETRY_COUNT="${SMOKE_RETRY_COUNT:-3}"
SMOKE_RETRY_DELAY_MS="${SMOKE_RETRY_DELAY_MS:-1200}"

if ! [[ "${SMOKE_RETRY_COUNT}" =~ ^[0-9]+$ ]] || [[ "${SMOKE_RETRY_COUNT}" -lt 1 ]]; then
  SMOKE_RETRY_COUNT=3
fi
if ! [[ "${SMOKE_RETRY_DELAY_MS}" =~ ^[0-9]+$ ]] || [[ "${SMOKE_RETRY_DELAY_MS}" -lt 0 ]]; then
  SMOKE_RETRY_DELAY_MS=1200
fi
SMOKE_RETRY_DELAY_SEC="$(awk "BEGIN { printf \"%.3f\", ${SMOKE_RETRY_DELAY_MS} / 1000 }")"

PAIRS=(
  "BTC:BTC"
  "ETH:ETH"
  "XRP:XRP"
  "BNB:BSC"
  "TRX:TRX"
  "FIL:FIL"
  "USDT:ETH"
  "USDT:BSC"
  "USDT:TRX"
  "SOL:SOL"
)

echo "[smoke-holders] base=${BASE_URL}"

FAIL_COUNT=0

for pair in "${PAIRS[@]}"; do
  asset="${pair%%:*}"
  chain="${pair##*:}"
  pair_ok=0

  for attempt in $(seq 1 "${SMOKE_RETRY_COUNT}"); do
    response=""
    if response="$(curl -fsS "${BASE_URL}/market/holders?asset=${asset}&chain=${chain}")" && ASSET="${asset}" CHAIN="${chain}" RESPONSE="${response}" REQUIRE_SOL_HOLDER="${REQUIRE_SOL_HOLDER}" REQUIRE_USDT_BSC_HOLDER="${REQUIRE_USDT_BSC_HOLDER}" node <<'NODE'
const asset = String(process.env.ASSET || '').toUpperCase();
const chain = String(process.env.CHAIN || '').toUpperCase();
const requireSol = String(process.env.REQUIRE_SOL_HOLDER || '0') === '1';
const requireUsdtBsc = String(process.env.REQUIRE_USDT_BSC_HOLDER || '0') === '1';

let payload;
try {
  payload = JSON.parse(String(process.env.RESPONSE || '{}'));
} catch (error) {
  console.error(`[fail] ${asset}/${chain} invalid JSON payload`);
  process.exit(1);
}

const holder = Number(payload?.holderCount);
const hasHolder = Number.isFinite(holder) && holder > 0;
const allowEmpty =
  (asset === 'SOL' && !requireSol) ||
  (asset === 'USDT' && chain === 'BSC' && !requireUsdtBsc);

if (!hasHolder && !allowEmpty) {
  console.error(
    `[fail] ${asset}/${chain} holderCount missing source=${payload?.source ?? 'unknown'} metricType=${payload?.metricType ?? 'unknown'}`
  );
  process.exit(1);
}

if (!hasHolder && allowEmpty) {
  console.log(
    `[warn] ${asset}/${chain} holderCount missing (allowed) source=${payload?.source ?? 'unknown'} metricType=${payload?.metricType ?? 'unknown'}`
  );
  process.exit(0);
}

console.log(
  `[ok] ${asset}/${chain} holderCount=${Math.floor(holder)} source=${payload?.source ?? 'unknown'} metricType=${payload?.metricType ?? 'unknown'}`
);
NODE
    then
      pair_ok=1
      break
    fi

    if [[ "${attempt}" -lt "${SMOKE_RETRY_COUNT}" ]]; then
      echo "[retry] ${asset}/${chain} attempt ${attempt}/${SMOKE_RETRY_COUNT} failed, retry in ${SMOKE_RETRY_DELAY_SEC}s"
      sleep "${SMOKE_RETRY_DELAY_SEC}"
    fi
  done

  if [[ "${pair_ok}" -ne 1 ]]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  echo "[smoke-holders] failed=${FAIL_COUNT}"
  exit 1
fi

echo "[smoke-holders] done"
