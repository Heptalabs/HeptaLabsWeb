# FIL Lottery Filecoin Android PRD (v1)

## KR (본문)

## 1) 문서 목적
이 문서는 Filecoin 마이너의 epoch별 블록 생성 여부를 당첨 트리거로 사용하는 Android 전용 로터리 앱의 제품/개발 기준 문서다.

핵심 원칙:
- 당첨 판정은 "지정 마이너의 epoch 블록 생성 여부"로만 결정
- 당첨금 지급은 마이너 보상이 아니라 플랫폼 풀(내부 원장)에서 즉시 지급
- 배포는 Android APK 직접 배포 + 랜딩페이지 다운로드 방식

## 2) 제품 개념
### 2.1 라운드 구조 (KST 기준)
- 판매창: D일 00:00 ~ D+1일 00:00
- 관측창: D+1일 00:00 ~ D+2일 00:00 (정확히 2880 epoch)
- 발표/지급: D+2일 00:00 (즉시 발표 모드)

예시:
- 판매: 2026-05-01 00:00 ~ 2026-05-02 00:00
- 관측: 2026-05-02 00:00 ~ 2026-05-03 00:00
- 발표: 2026-05-03 00:00

### 2.2 티켓 매핑
- 티켓 번호: 1~2880
- 관측창 내 epoch index: 1~2880
- 규칙: `티켓 i` <-> `epoch i`
- 지정 마이너가 해당 epoch에서 블록 생성 성공 시 티켓 i 당첨

### 2.3 미달 좌석 처리
- 2880명 미만이면 플랫폼 시스템 계정으로 자동 채움
- 최종적으로 항상 2880 티켓 확정 후 관측 시작

## 3) MVP 범위 (Must Have)
### 3.1 사용자 앱
- 회원가입/로그인
- 내부 FIL 잔고 조회
- 참여(0.1 FIL 고정)
- 내 티켓 조회
- 실시간 관측 진행바(1~2880)
- 결과 조회(당첨/비당첨)
- 당첨금 내부잔고 즉시 반영
- 입금/출금 기본 UX
- 알림함/푸시

### 3.2 운영(Admin)
- 라운드 생성/상태 전환
- 지정 마이너 설정
- 자동채움 실행/확인
- 관측 로그 대시보드
- 결과 확정 및 자동지급
- 지급 실패 재시도
- 감사 로그 조회

### 3.3 랜딩페이지
- 서비스 한 줄 소개
- Android APK 다운로드 버튼
- 버전/빌드 일시/체크섬(SHA-256)
- 설치 가이드(알 수 없는 앱 허용 안내)
- 최소 FAQ

## 4) 추가 보완사항 (필수 권장)
### 4.1 판정 안정성
- 다중 RPC 소스 교차검증(최소 2개)
- 판정 기준 노드 장애 시 failover
- `null epoch` 명시 처리(비당첨)
- 같은 epoch 내 동일 마이너 다중 블록 발생 시 1회 당첨 처리

### 4.2 정산 안정성
- 내부원장 트랜잭션 idempotency key
- 지급 배치 재실행 안전성(중복지급 방지)
- 지급 실패 큐 + 지수 백오프

### 4.3 투명성
- 라운드별 판정 원본 로그 공개 API
- 티켓별 판정 근거 조회 API
- CSV 내보내기

### 4.4 운영성
- 스케줄러 드리프트 감시
- 라운드 상태 불일치 자동 복구 잡
- 치명 에러 Slack/Telegram 알림

## 5) 상세 비즈니스 규칙
### 5.1 티켓 판매
- 가격: 0.1 FIL
- 기본 정책: 1인 1티켓 (옵션으로 N티켓 확장 가능)
- 판매 마감 시점 이전까지만 구매 가능

### 5.2 자동채움
- 판매 마감 직후 `미달 = 2880 - 판매수량`
- 플랫폼 계정으로 티켓 번호 뒤에서부터 순차 발급
- 자동채움 내역은 일반 유저에게도 표시

### 5.3 당첨 판정
입력값:
- 관측 시작 epoch `startEpoch`
- 관측 종료 epoch `endEpoch = startEpoch + 2879`
- 지정 마이너 ID 주소(예: f0...)

절차:
1. i=1..2880 반복
2. targetEpoch = startEpoch + (i-1)
3. targetEpoch tipset 조회
4. tipset 블록 목록에서 miner == 지정 마이너 여부 확인
5. 참이면 티켓 i 당첨

### 5.4 예외 처리
- tipset 조회 실패: 재시도 후 대체 RPC 조회
- 최종 실패 epoch: `PENDING_RECHECK`로 남기고 후속 재판정
- 발표 시점에 PENDING 존재 시:
  - 정책 A: 전체 발표 보류
  - 정책 B: 확정분 먼저 발표 + 미확정분 별도 공지

권장: 정책 A (사용자 혼란 최소화)

### 5.5 지급 규칙
- 라운드 풀: 2880 * 0.1 FIL = 288 FIL
- 기본 분배: 당첨자 균등분배
- 플랫폼 티켓 당첨분 처리 방식(택1):
  - 소각(다음 라운드 재원 미이월)
  - 리저브 적립
  - 다음 라운드 캐리오버

권장: 리저브 적립(회계/운영 단순)

## 6) 시스템 아키텍처
- Android App (React Native)
- Admin Console (Web)
- API Server
- Lottery Engine Worker
- Wallet/Ledger Service
- Chain Observer (Lotus/Remote RPC)
- Notification Service
- Landing Page Static Host

### 6.1 모듈 책임
- API: 인증, 조회, 명령 수신
- Worker: 라운드 상태머신, 관측, 정산
- Ledger: 잔고/락/정산 원장
- Observer: epoch/tipset/블록 데이터 수집 및 정규화

## 7) 라운드 상태머신
- `DRAFT`
- `SELLING`
- `FILLING`
- `OBSERVING`
- `CALCULATING`
- `PAYING`
- `COMPLETED`
- `FAILED`

전이 규칙:
- 시간 기반 자동 전이 + 운영자 강제 전이(권한 제한)

## 8) API v1 (초안)
### 8.1 사용자
- `POST /auth/login`
- `GET /me`
- `GET /wallet/balance`
- `POST /rounds/{id}/join`
- `GET /rounds/current`
- `GET /rounds/{id}`
- `GET /rounds/{id}/tickets/me`
- `GET /rounds/{id}/results/me`
- `GET /wallet/txs`

### 8.2 공개/검증
- `GET /public/rounds/{id}/summary`
- `GET /public/rounds/{id}/winners`
- `GET /public/rounds/{id}/epoch-map`
- `GET /public/rounds/{id}/ticket/{no}`

### 8.3 운영
- `POST /admin/rounds`
- `POST /admin/rounds/{id}/start-selling`
- `POST /admin/rounds/{id}/fill-missing`
- `POST /admin/rounds/{id}/start-observing`
- `POST /admin/rounds/{id}/calculate`
- `POST /admin/rounds/{id}/pay`
- `POST /admin/rounds/{id}/retry-failed-payouts`

## 9) DB 스키마 (핵심 테이블)
- `users`
- `wallet_accounts`
- `wallet_ledger`
- `rounds`
- `tickets`
- `epoch_observations`
- `winners`
- `payouts`
- `jobs`
- `audit_logs`

핵심 제약:
- `tickets(round_id, ticket_no)` unique
- `winners(round_id, ticket_id)` unique
- `payouts(round_id, user_id)` unique
- `wallet_ledger(idempotency_key)` unique

## 10) 스케줄/배치
- `round-transition-job`: 매 분
- `observer-job`: 30초 간격(또는 epoch 이벤트 기반)
- `calculation-job`: OBSERVING 종료 직후
- `payout-job`: CALCULATING 완료 후
- `reconcile-job`: 매일 1회

## 11) 랜딩페이지 명세 (Android APK)
경로 예시:
- `/download/index.html`
- `/downloads/latest.json`

### 11.1 섹션
1. Hero: 서비스 소개 + 다운로드 버튼
2. How It Works: 3단계(참여-관측-지급)
3. Trust: 판정 투명성/로그 공개
4. Download: 최신 버전 카드
5. FAQ: 설치/업데이트/보안

### 11.2 다운로드 카드 필드
- 버전명 (예: v1.0.0)
- 빌드번호
- APK 파일 크기
- SHA-256
- 릴리즈 일시
- 최소 Android 버전
- 다운로드 버튼

### 11.3 파일 규약
- APK: `fil-lottery-vX.Y.Z+build.apk`
- 메타: `latest.json`
  - `version`
  - `build`
  - `url`
  - `sha256`
  - `releasedAt`
  - `minSdk`

## 12) iPhone 대응 전략 (앱스토어 비의존 우선)
요청사항이 "APK 중심"이므로 iPhone은 단계적으로 대응한다.

### 옵션 A (권장 1단계)
- iOS는 웹만 지원 (모바일 웹/PWA)
- 기능: 라운드 조회, 티켓 조회, 결과 조회 중심
- 장점: 즉시 제공 가능, 운영 단순
- 단점: 네이티브 지갑 UX 제한

### 옵션 B (권장 2단계)
- TestFlight 비공개 베타 배포
- 장점: 앱스토어 공개 없이 iOS 앱 테스트 가능
- 단점: 베타 성격, 만료/운영 관리 필요

### 옵션 C (특수)
- Enterprise 배포(사내 직원 전용)
- 장점: 내부 조직 배포 가능
- 단점: 일반 대중 배포용으로 부적합

### 옵션 D (EU 한정)
- EU 대체 마켓/웹 배포 체계 활용
- 장점: 앱스토어 외 배포 가능
- 단점: 지역/정책/운영요건 복잡

의사결정 권장:
- 현재: Android APK + iOS 웹
- 다음: iOS TestFlight private beta

## 13) 릴리즈 단계 계획
### Phase 1 (2~4주)
- 라운드 엔진 MVP
- Android APK 배포
- 랜딩페이지
- 내부원장 기본 정산

### Phase 2 (2~3주)
- 투명성 API/CSV
- 운영 대시보드 고도화
- 장애 복구 자동화

### Phase 3 (2~4주)
- iOS 웹 최적화/PWA
- iOS TestFlight 베타
- 성능/보안/운영 지표 고도화

## 14) 완료 정의 (DoD)
- 라운드 3회 연속 무중단 운영
- 자동채움/관측/정산/지급 전 과정 자동화
- 중복지급 0건
- 사용자 단말에서 APK 다운로드~설치~참여까지 5분 이내
- 판정 근거 조회 API 정상 제공

## 15) 오픈 이슈
- 당첨금 분배 정책(균등/가중) 최종 확정
- 플랫폼 티켓 당첨금 처리(리저브/캐리오버) 확정
- 발표 시점(즉시 vs 추가 확정 대기) 확정
- 1인 다티켓 허용 여부 확정

---

## 中文摘要
- 该方案是“矿工出块触发型”彩票，而不是随机数抽签。
- 每轮固定 2880 张票，对应观察窗口内 2880 个 epoch。
- 某 epoch 若目标矿工出块，则对应票号中奖。
- Android 仅通过 APK + 落地页分发；落地页展示版本、校验和、下载按钮。
- iPhone 建议先支持移动网页，再考虑 TestFlight 私测。

---

## English Summary
- This is a miner-performance-triggered lottery, not random draw.
- Each round has exactly 2880 tickets mapped to 2880 epochs.
- If the target miner produces a block in epoch i, ticket i wins.
- Android distribution is APK-only via a landing page with checksum/version metadata.
- For iPhone, start with mobile web, then optionally move to private TestFlight beta.

## Reference Links
- Filecoin 30-second epoch / tipsets: https://docs.filecoin.io/basics/the-blockchain/blocks-and-tipsets
- Filecoin consensus per epoch: https://docs.filecoin.io/basics/the-blockchain/consensus
- Filecoin finality/chain APIs: https://docs.filecoin.io/reference/json-rpc/chain
- TestFlight overview: https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview
- Apple Enterprise Program scope: https://developer.apple.com/programs/enterprise/
- Alternative EU distribution docs: https://developer.apple.com/documentation/appstoreconnectapi/alternative-marketplaces-and-web-distribution
- Unlisted App distribution: https://developer.apple.com/support/unlisted-app-distribution
