# IMWallet Console

KR | [中文](#中文) | [English](#english)

## KR

IMWallet 앱의 mock 기능(자산/전송/활동/보안 설정)에 대응하는 운영 콘솔입니다.

### 포함 화면
- KPI: 총 익스포저, 활성 지갑, 대기 큐, 고위험 알림
- Transaction Queue: `send/receive/buy/swap/browser` 플로우 + 승인/수동검토/차단 상태
- Policies: 리스크/한도 정책 토글
- Audit Logs: 운영 이벤트 감사 로그 확인
- User Controls: 사용자 검색 및 한도 상향 액션
- 다국어 전환: 한국어 / English / 中文

### 인증 흐름
- 비밀번호 + MFA 2단계 로그인
- 데모 계정:
  - `admin@imwallet.local` / `admin123!@#` (admin)
  - `ops@imwallet.local` / `ops123!@#` (operator)
  - `compliance@imwallet.local` / `cmp123!@#` (compliance)
- MFA 코드: `000000`

### 실행
```bash
cd /Users/heptalabs/Documents/New\ project/SJK/imwallet-console
npm install
npm run dev
```
- 브라우저: `http://localhost:5173`

### 빌드 검증
```bash
cd /Users/heptalabs/Documents/New\ project/SJK/imwallet-console
npm run typecheck
npm run test:run
npm run build
```

---

## 中文

### 摘要
- 这是与 IMWallet App mock 功能对应的运营控制台。
- 支持双因素登录（密码 + MFA），MFA 演示码为 `000000`。
- 本地启动后访问 `http://localhost:5173` 即可在 Chrome 预览。

---

## English

### Summary
- This is a mock console aligned with the IMWallet app flows.
- It supports a production-style password + MFA sign-in flow (mock MFA code: `000000`).
- Run locally and open `http://localhost:5173` in Chrome.
