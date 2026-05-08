#!/usr/bin/env bash
set -euo pipefail

export REQUIRE_RECOMMENDED="${REQUIRE_RECOMMENDED:-1}"
export REQUIRE_SOL_HOLDER="${REQUIRE_SOL_HOLDER:-1}"
export REQUIRE_USDT_BSC_HOLDER="${REQUIRE_USDT_BSC_HOLDER:-1}"
export SMOKE_RETRY_COUNT="${SMOKE_RETRY_COUNT:-5}"
export SMOKE_RETRY_DELAY_MS="${SMOKE_RETRY_DELAY_MS:-1500}"

bash ./scripts/preflight-prod.sh "$@"
