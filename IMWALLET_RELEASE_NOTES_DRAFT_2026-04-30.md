# IMWallet 릴리즈 노트 초안 (2026-04-30)

## 변경 요약
- 드롭다운/시트 딤 처리 정책 점검 자동화 추가(CI 실패 조건 포함)
- 치명 오류 화면에서 내부 에러 메시지(raw string) 노출 차단
- Discover 상단 카드의 IMWallet 주간 브리핑 고정 경로 강화
- DappRadar 연동 경로 코드화(엔드포인트 유도 규칙, 실패 사유 진단 노출)
- 운영 키 관리 스크립트에 DappRadar 키 반영

## 사용자 체감 변경
1. 앱 오류 화면
- 기존: `undefined is not a function` 같은 내부 오류 문구 직접 노출
- 변경: 사용자 안내용 일반 문구만 노출

2. Discover 상단 카드
- 기존: 상황에 따라 외부 카드(CoinDesk/PancakeSwap 등)가 상단 카드로 노출될 수 있음
- 변경: 상단 카드는 IMWallet 주간 브리핑을 우선/기본으로 사용

3. DApp 카테고리 10개 보장 정책
- 실데이터 부족 시 fallback seed로 카테고리별 10개 충족 정책 유지
- 검증 스크립트에서 카테고리별 effectiveCount를 확인 가능

## 엔지니어링 변경 상세
- App: `imwallet-app/App.tsx`
  - 안전 에러 메시지 상수 도입
  - Discover 상단 카드 fallback을 주간 브리핑으로 고정
- Backend: `backend/src/config.js`
  - DappRadar endpoint 구성용 환경변수 확장
- Backend: `backend/src/services/market-dapps.js`
  - provider diagnostics 추가
  - DappRadar endpoint 미설정/키 미설정 사유 명시
- Scripts:
  - `backend/scripts/check-provider-connectivity.sh`
  - `backend/scripts/check-prod-env.sh`
  - `backend/scripts/set-prod-keys.sh`
  - `backend/scripts/set-prod-keys-from-env.sh`
  - `backend/scripts/set-prod-keys-from-keychain.sh`
  - `backend/scripts/set-keychain-prod-keys-from-env.sh`

## 검증 결과
- App
  - `npm run -s typecheck` PASS
  - `npm run -s test:run` PASS
  - `npm run -s check:dropdown-policy` PASS
- Backend
  - `npm run -s check:providers` PASS (키/엔드포인트 미설정은 warn)
  - `npm run -s check:dapps:categories` PASS

## 운영 적용 전 필수 확인
1. DappRadar 실연동 키/설정
- 필수:
  - `DAPPRADAR_API_KEY`
  - `DAPPRADAR_PROJECT_ID` (또는 `DAPPRADAR_TOP_DAPPS_ENDPOINT`)

2. 현재 상태
- 로컬/배포 env에서 DappRadar 관련 값은 아직 미설정
- 미설정 시 앱은 fallback 경로로 동작

## 잔여 리스크
- DappRadar 실키 미설정 상태에서는 provider가 defillama 중심으로 동작
- 상단 카드 데이터 운영 자동화(월요일 09:00 갱신)는 실행 주체(서버 잡/외부 자동화) 최종 연결이 필요

## 롤백 포인트
- Discover 카드 관련 이슈 발생 시
  - 상단 카드 노출 로직(App.tsx)과 content source(backend discover-content) 분리 확인
- Dapp source 문제 발생 시
  - `check:providers`, `check:dapps:categories` 재실행 후 providerDiagnostics 확인

---

## 中文摘要
- 已强化顶部卡片逻辑：优先并默认展示 IMWallet 每周简报。
- 已隐藏面向用户的内部崩溃原文错误。
- 已接入 DappRadar 配置路径与诊断信息，但生产密钥尚未配置。

## English Summary
- Top Discover card behavior is now hardened to prioritize/fallback to IMWallet Weekly Briefing.
- Raw internal crash strings are no longer exposed to end users.
- DappRadar integration path and diagnostics are implemented, but production keys are still pending.
