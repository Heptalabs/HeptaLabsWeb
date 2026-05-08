# Backend Starter

This backend starter is aligned with:
- `PRODUCT_PRD_V2.md`
- `database/schema_v1.sql`
- `database/functions_v1.sql`
- `database/seed_v1.sql`

## Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Docker + Docker Compose (optional)

## Setup
1. Copy env file
```bash
cp .env.example .env
```
2. Update `.env` values (`DATABASE_URL`, `JWT_SECRET`)
3. Install dependencies
```bash
npm install
```

### CoinMarketCap Pro Key (recommended for production)
Set this in local-only override file:
```bash
npm run set:cmc-key -- <YOUR_KEY>
```
`/api/v1/market/popular-tokens` will use CoinMarketCap Pro when this key is configured.
`/api/v1/market/prices` source policy:
- USD/CNY: CoinMarketCap Pro (when key exists)
- KRW: Coinone public ticker first, then fallback
- final fallback: CoinGecko/derived FX values when upstream data is missing

### DApp ranking providers (multi-source)
`/api/v1/market/popular-dapps` supports provider chaining via env:

- `MARKET_DAPP_PROVIDERS=dappradar,defillama` (order = priority)
- DappRadar endpoint config (choose one):
  - explicit: `DAPPRADAR_TOP_DAPPS_ENDPOINT=...`
  - derived: `DAPPRADAR_BASE_URL=https://apis.dappradar.com` + `DAPPRADAR_PROJECT_ID=...` + `DAPPRADAR_TOP_DAPPS_PATH=dapps/top/uaw`
- `DAPPRADAR_API_KEY` (required for DappRadar provider)
- `DAPPRADAR_AUTH_HEADER` (default: `X-BLOBR-KEY`)
- `DAPPRADAR_AUTH_PREFIX` (default: empty)
- optional query tuning:
  - `DAPPRADAR_TOP_RANGE=30d`
  - `DAPPRADAR_TOP_LIMIT_PARAM=top`

If DappRadar is unavailable, the endpoint automatically falls back to DefiLlama and returns provider status metadata.
Provider diagnostics are exposed in API response as `providerDiagnostics` and logged via `provider_fetch_failed` / `provider_fallback_applied`.

Category bucket endpoint (used by app category tabs):
- `GET /api/v1/market/popular-dapps/by-category?limit=10`
- Response includes `dappsByCategory.all|defi|exchanges|collectibles|social|games`

## DB bootstrap
```bash
npm run db:bootstrap
```

## Run server
```bash
npm run dev
```

## Run with Docker Compose
From repository root:
```bash
JWT_SECRET='replace-with-strong-random-secret' docker compose -f backend/docker-compose.yml up --build
```

Stop and remove containers/volumes:
```bash
docker compose -f backend/docker-compose.yml down -v
```

Follow logs:
```bash
docker compose -f backend/docker-compose.yml logs -f api
```

Base URL:
- `http://localhost:4000/api/v1`

OpenAPI:
- `openapi/openapi.v1.yaml`

Postman:
- `postman/heptalabs-api.postman_collection.json`
- `postman/heptalabs-local.postman_environment.json`

## Batch run API
`POST /api/v1/admin/batch/run`

Body (optional):
```json
{ "businessDate": "2026-03-24" }
```

## Smoke Test Script
Run member-only checks:
```bash
./scripts/smoke-test.sh
```

Run member + admin checks:
```bash
ADMIN_PASSWORD='<your-admin-password>' ./scripts/smoke-test.sh
```

Optional env overrides:
- `BASE_URL`
- `MEMBER_LOGIN_ID`, `MEMBER_PASSWORD`, `MEMBER_NAME`, `MEMBER_PHONE`, `MEMBER_EMAIL`
- `ADMIN_LOGIN_ID`, `ADMIN_PASSWORD`

## Discover Content Ops
- Public feed: `GET /api/v1/content/discover`
- Public click log: `POST /api/v1/content/discover/click`
- Admin content requires `x-admin-role` header (`viewer`, `operator`, `compliance`, `admin`)
- Image upload endpoint: `POST /api/v1/content/admin/upload-image`

Quick smoke for discover content APIs:
```bash
npm run smoke:content
```

## Production Preflight
Before deploying to production, run these checks in order:

1. Create base production env
```bash
cp .env.production.example .env.production
```

2. Create key-only env file (recommended)
```bash
cp .env.production.keys.example .env.production.keys
npm run set:prod-keys
```

3. Environment sanity check (`.env.production` + optional `.env.production.keys`)
```bash
npm run check:prod-env
```

4. External provider connectivity check
```bash
npm run check:providers
```

5. One-command preflight (env + providers + health + holder/content smoke)
```bash
npm run preflight:prod
```

Strict holder mode (optional):
```bash
REQUIRE_SOL_HOLDER=1 REQUIRE_USDT_BSC_HOLDER=1 npm run preflight:prod
```

Strict production mode (recommended before real cutover):
```bash
npm run preflight:prod:strict
```

Retry tuning for unstable public endpoints (optional):
```bash
SMOKE_RETRY_COUNT=5 SMOKE_RETRY_DELAY_MS=1500 npm run preflight:prod
```

Optional arguments:
- `npm run check:prod-env -- .env.production`
- `npm run check:providers -- .env.production`
- `npm run preflight:prod -- http://127.0.0.1:4000/api/v1 .env.production`
- `npm run preflight:prod -- http://127.0.0.1:4000/api/v1 .env.production .env.production.keys`

Ops helper files:
- `ops/healthcheck.sh`
- `ops/logrotate-imwallet-backend.conf`
