# IMWALLET_APP_MOCK_DEV

KR | [中文](#中文) | [English](#english)

## KR

## 1) 목적
이 문서는 IMWallet의 **앱 + 콘솔**을 서버 없이 mock-first로 개발하고, 크롬에서 먼저 확인하기 위한 로컬 실행 가이드다.

## 2) 현재 구성
- 앱(Expo): `imwallet-app/`
- 콘솔(Vite + React): `imwallet-console/`
- 공통 원칙:
  - 실제 체인 브로드캐스트/운영 DB 연동 없이 UI/플로우 우선
  - 실기기(Expo Go) 또는 브라우저(Chrome)에서 빠른 반복 검증

## 3) 코드 위치
- 앱 핵심 파일
  - `imwallet-app/App.tsx`
  - `imwallet-app/src/data/mockWallet.ts`
  - `imwallet-app/src/theme/tokens.ts`
- 콘솔 핵심 파일
  - `imwallet-console/src/App.tsx`
  - `imwallet-console/src/data/mockAdmin.ts`
  - `imwallet-console/src/styles.css`

## 4) 크롬에서 바로 실행

### 4.1 앱(Expo Web)
```bash
cd /Users/heptalabs/Documents/New\ project/SJK/imwallet-app
npm install
npm run web
```
- 브라우저 접속: `http://localhost:8081` (또는 터미널 출력 URL)

### 4.2 콘솔(Vite)
```bash
cd /Users/heptalabs/Documents/New\ project/SJK/imwallet-console
npm install
npm run dev
```
- 브라우저 접속: `http://localhost:5173`

### 4.3 앱 + 콘솔 동시 확인
- 터미널 1:
```bash
cd /Users/heptalabs/Documents/New\ project/SJK/imwallet-app
npm run web
```
- 터미널 2:
```bash
cd /Users/heptalabs/Documents/New\ project/SJK/imwallet-console
npm run dev
```

## 5) 모바일 실기기(선택)
```bash
cd /Users/heptalabs/Documents/New\ project/SJK/imwallet-app
npx expo start -c --lan
```
- 같은 Wi-Fi에서 Expo Go로 QR 스캔

## 6) 현재 반영된 화면 방향
- 앱: Trust Wallet 레퍼런스 기반의 다크 톤 지갑 UX(홈/전송/활동/설정)
- 콘솔: 앱 기능 대응 운영 콘솔(거래 큐, 리스크 알림, 자산 익스포저, 체인 상태, 사용자 제어)
- 공통: 앱/콘솔 모두 UI 내 언어 전환 지원(한국어 / English / 中文)

## 7) 검증 커맨드
```bash
# 앱 타입 체크
cd /Users/heptalabs/Documents/New\ project/SJK/imwallet-app
npx tsc --noEmit

# 앱 웹 번들 확인
cd /Users/heptalabs/Documents/New\ project/SJK/imwallet-app
npx expo export --platform web

# 콘솔 빌드 확인
cd /Users/heptalabs/Documents/New\ project/SJK/imwallet-console
npm run build
```

## 8) 가정
- 가정 A: 현재 단계는 시각/플로우 검증이 목적이며 실거래 정확도 검증 범위는 제외한다.
- 가정 B: 콘솔 수치와 경고 규칙은 mock 데이터 기준이며 운영 정책 확정 후 동기화한다.

---

## 中文

### 摘要
- 现在已同时提供 App（Expo）与 Console（Vite）两套本地项目，并可先在 Chrome 查看。
- App 地址默认 `http://localhost:8081`，Console 地址默认 `http://localhost:5173`。
- 目前是 mock-first 阶段：重点是 UI/流程验证，尚未接入真实链广播与生产数据库。

---

## English

### Summary
- Both App (Expo) and Console (Vite) are now available for local development and can be previewed in Chrome first.
- App default URL is `http://localhost:8081`, and Console default URL is `http://localhost:5173`.
- Current stage is mock-first: focused on UX flow validation without real chain broadcast or production DB integration.
