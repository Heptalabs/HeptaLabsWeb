# IMWallet 실서버 마이그레이션 실행 런북

기준일: 2026-04-22 (KST)

## 1) 실키 주입 + Strict Preflight
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
export COINMARKETCAP_API_KEY="..."
export COINMETRICS_API_KEY="..."
export ETHERSCAN_API_KEY="..."
export TRONSCAN_API_KEY="..."
export SOLSCAN_API_KEY="..."
# (선택) macOS 키체인에 저장
npm run set:keychain-keys:env
# 키 파일 반영 (env 또는 keychain)
npm run set:prod-keys:env
# 또는
# npm run set:prod-keys:keychain
npm run preflight:prod:strict
```

## 2) 운영 환경값 최종 확정
- `backend/.env.production`
  - `NODE_ENV=production`
  - `DATABASE_URL` (운영 DB)
  - `JWT_SECRET` (32+ 강랜덤)
  - `CORS_ALLOWED_ORIGINS` (운영 도메인만)
  - `CONTENT_ADMIN_REQUIRE_AUTH=true`
  - `CONTENT_ADMIN_ALLOW_LEGACY_ROLE_HEADER=false`
- `imwallet-console` 빌드 환경
  - `VITE_USE_MOCK_API=false`
  - `VITE_BACKEND_BASE_URL=https://<api-domain>`

## 3) DB 백업/복구 리허설
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
npm run db:backup -- .env.production
```
- 생성된 `ops/backups/*.dump`를 사용해 복구 리허설:
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
npm run db:restore:rehearsal -- ops/backups/<backup-file>.dump .env.production
```
- 로컬에 Postgres/pg_dump/psql이 없으면:
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
npm run db:rehearsal:embedded -- .env.production
```

## 4) 앱 실기기 E2E 최종 점검 (수동)
- 필수 시나리오
  - 지갑 생성/복구(시드 구문)
  - 자산 보내기/받기(주소 검증, 수량 검증, 전송 확인/상세)
  - NFT 상세/보내기/받기
  - 한/영/중 언어 전환
  - 라이트/다크 전환
  - 비밀번호/생체 인증 진입 및 보안 페이지 가드

## 5) 콘솔 RBAC + 감사 로그 점검
```bash
cd "/Users/heptalabs/Documents/New project/SJK/imwallet-console"
npm run test:run
```
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
# CONTENT_ADMIN_SMOKE_LOGIN_ID / CONTENT_ADMIN_SMOKE_PASSWORD 또는 토큰 지정 시 더 많은 검증 수행
npm run smoke:authz -- http://127.0.0.1:4000/api/v1
```

## 6) 컷오버/롤백 리허설
- 컷오버 전 전체 점검 자동 실행:
```bash
cd "/Users/heptalabs/Documents/New project/SJK"
bash ./scripts/imwallet-cutover-check.sh
```
- Strict 포함 점검:
```bash
cd "/Users/heptalabs/Documents/New project/SJK"
STRICT_MODE=1 bash ./scripts/imwallet-cutover-check.sh
```
- 롤백 기본:
  1. 직전 배포 아티팩트 재배포
  2. 필요 시 DB 백업본으로 복구
  3. `backend/scripts/post-cutover-smoke.sh` 재검증

## 7) 모니터링/알람 점검
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
npm run smoke:post-cutover -- http://127.0.0.1:4000/api/v1 .env.production
```
- 최소 알람 권장
  - `/api/v1/health` 실패
  - 주요 시장데이터 엔드포인트 5xx
  - 인증 엔드포인트 5xx 급증
  - 응답 지연 임계치 초과
