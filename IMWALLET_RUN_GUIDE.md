# IMWallet 실행 가이드 (App + Console)

## KR

### 1) 앱 (모바일 UI, Expo) 실행
```bash
cd "/Users/heptalabs/Documents/New project/SJK/imwallet-app"
npm install
npm run web
```
- Chrome: `http://localhost:8081`
- 확인 포인트:
  - 멀티 지갑 선택 헤더 + Send / Receive / History 플로우
  - 코인/체인별 자산 관리 토글
  - 전송 확인/고급 가스 설정/인증/처리/상세 화면
  - `Wallet / Discover / Settings` 하단 탭
  - 우측 상단 언어 전환 `KO / EN / 中`

### 2) 앱 (실기기 Expo Go) 실행
```bash
cd "/Users/heptalabs/Documents/New project/SJK/imwallet-app"
npx expo start -c --lan
```
- 같은 Wi-Fi에서 Expo Go로 QR 스캔

### 3) 콘솔 (웹) 실행
```bash
cd "/Users/heptalabs/Documents/New project/SJK/imwallet-console"
npm install
npm run dev
```
- Chrome: `http://localhost:5173`
- 확인 포인트:
  - 로그인(비밀번호 + MFA) 후 권한별 메뉴 접근
  - 트랜잭션 큐 / 정책 / 유저 제어 / 감사 로그
  - 상단 언어 전환 `KO / EN / 中`
  - 기본은 개발 Mock 모드(`VITE_USE_MOCK_API=true`)이며, 운영 전환 시 백엔드 인증 연동 모드로 변경

### 4) 빌드 검증
```bash
cd "/Users/heptalabs/Documents/New project/SJK/imwallet-app"
npm run typecheck
npm run test:run
npm run build:web

cd "/Users/heptalabs/Documents/New project/SJK/imwallet-console"
npm run typecheck
npm run test:run
npm run build
```

### 5) 백엔드 시장데이터(홀더 수) 스모크 검증
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
npm install
npm run smoke:holders
```
- 기본 검증 대상:
  - `BTC/ETH/XRP/BNB/TRX/FIL`
  - `USDT(ETH/BSC/TRX)`
  - `SOL` (기본은 경고 허용, 강제 검증 시 `REQUIRE_SOL_HOLDER=1 npm run smoke:holders`)
  - `USDT/BSC` (기본은 경고 허용, 강제 검증 시 `REQUIRE_USDT_BSC_HOLDER=1 npm run smoke:holders`)
- 권장 환경변수:
  - `ETHERSCAN_API_KEY`, `TRONSCAN_API_KEY`
  - `SOLSCAN_API_KEY` (없어도 fallback 시도)

### 6) 운영 전환 전 Preflight 점검
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
npm run check:prod-env
npm run check:providers
npm run preflight:prod
```
- 기본 설정:
  - env 파일: `.env.production`
  - API Base URL: `http://127.0.0.1:4000/api/v1`
- 인자로 변경 가능:
  - `npm run check:prod-env -- .env.production`
  - `npm run check:providers -- .env.production`
  - `npm run preflight:prod -- http://127.0.0.1:4000/api/v1 .env.production`
- 엄격 홀더 검증(선택):
  - `REQUIRE_SOL_HOLDER=1 REQUIRE_USDT_BSC_HOLDER=1 npm run preflight:prod`
- 운영 컷오버 전 엄격 점검(권장):
  - `npm run preflight:prod:strict`
- 퍼블릭 엔드포인트 변동 시 재시도 강화(선택):
  - `SMOKE_RETRY_COUNT=5 SMOKE_RETRY_DELAY_MS=1500 npm run preflight:prod`

### 6-1) 전체 컷오버 통합 점검(앱+콘솔+백엔드)
```bash
cd "/Users/heptalabs/Documents/New project/SJK"
bash ./scripts/imwallet-cutover-check.sh
```
- Strict 포함:
```bash
cd "/Users/heptalabs/Documents/New project/SJK"
STRICT_MODE=1 bash ./scripts/imwallet-cutover-check.sh
```

### 7) 운영 API 키 주입(권장)
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
cp .env.production.keys.example .env.production.keys
npm run set:prod-keys
```
- 키 파일은 `.env.production.keys`에 분리 저장되고 권한 `600`으로 생성됩니다.
- `check/preflight` 스크립트는 `.env.production` 사용 시 `.env.production.keys`를 자동 로드합니다.
- CI/자동화 환경(비대화형)에서는 환경변수 주입 방식 사용:
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
export COINMARKETCAP_API_KEY="..."
export COINMETRICS_API_KEY="..."
export ETHERSCAN_API_KEY="..."
export TRONSCAN_API_KEY="..."
export SOLSCAN_API_KEY="..."
npm run set:prod-keys:env
```
- macOS 키체인 사용(권장):
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
# 1) env -> keychain 등록
npm run set:keychain-keys:env
# 2) keychain -> .env.production.keys 동기화
npm run set:prod-keys:keychain
```

### 8) DB 백업/복구 리허설
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
npm run db:backup -- .env.production
npm run db:restore:rehearsal -- ops/backups/<backup-file>.dump .env.production
```
- `pg_dump`/`pg_restore`가 없는 환경에서는 자동으로 JSON fallback 백업(`.json`)이 생성됩니다.
- fallback 리허설 예시:
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
npm run db:backup -- .env.production
npm run db:restore:rehearsal -- ops/backups/<backup-file>.json .env.production
```
- 로컬 Postgres/pg_dump/psql이 없는 환경(자동 임베디드 리허설):
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
npm run db:rehearsal:embedded -- .env.production
```
- `RUN_SEED=1`을 주면 리허설 시 seed 단계까지 포함됩니다.

---

## 中文 (摘要)
- App (Expo Web): 在 `imwallet-app` 目录执行 `npm run web`，浏览器打开 `http://localhost:8081`
- Console (Web): 在 `imwallet-console` 目录执行 `npm run dev`，浏览器打开 `http://localhost:5173`
- 两端都支持 `KO / EN / 中` 语言切换
- Backend holders smoke: 在 `backend` 执行 `npm run smoke:holders`
- Production preflight: 在 `backend` 执行 `npm run preflight:prod`

---

## English (Summary)
- App (Expo Web): run `npm run web` in `imwallet-app`, open `http://localhost:8081`
- Console (Web): run `npm run dev` in `imwallet-console`, open `http://localhost:5173`
- Both app and console support `KO / EN / 中` language switching
- Backend holders smoke: run `npm run smoke:holders` in `backend`
- Production preflight: run `npm run preflight:prod` in `backend`
