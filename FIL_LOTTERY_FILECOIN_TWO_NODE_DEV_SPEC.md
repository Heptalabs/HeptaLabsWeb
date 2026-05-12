# FIL Lottery Filecoin 2-Node Development Spec (v1)

## KR (본문)

## 1) 문서 목적
본 문서는 지금까지 논의한 요구사항을 기준으로, Android APK 중심의 Filecoin 2-노드 로터리 앱 개발 기준을 고정한다.

핵심 목표:
- 사용자 입금/출금/참여/정산을 앱 내에서 일관되게 제공
- 라운드별 완료/취소 상태를 일자 단위로 명확히 공개
- 완료 라운드에 대해 당첨 번호와 익스플로러 증빙 링크를 제공

## 2) 범위
- 플랫폼: Android 앱 + 백엔드 API + 운영 콘솔 + 랜딩페이지
- 배포: 앱스토어 미사용, APK 직접 배포
- 로터리 상품: 지정된 2개 마이너 노드 상품 분리 운영

## 3) 확정 요구사항 요약
1. 회원가입 후 개인 FIL 잔고 화면 제공
2. 입금 주소 제공 -> 외부 지갑 송금 -> txid 입력 -> 자동 검증 후 잔고 반영
3. 출금 신청 시 수수료 차감 후 출금 처리
4. 잔고는 `입금 잔고`와 `당첨금 잔고`를 분리 표시, 출금 화면에서는 총 출금 가능액 동시 표기
5. 로터리 참여 시 수량 입력 가능(예: 10 입력 시 랜덤 티켓 10개 배정)
6. 티켓 번호는 참여순이 아닌 랜덤 배정(중복 불가)
7. 라운드는 2880 티켓 기준
8. 유저 판매수량이 1440 미만이면 라운드 취소
9. 유저 판매수량이 1440 이상이면 라운드 진행, 잔여 티켓은 플랫폼 자동 참여
10. 완료된 라운드는 날짜 클릭 시 당첨 번호/수량/증빙 링크 공개

## 4) 노드 상품 구성
### 4.1 상품 A
- 마이너: `f01083914`
- 표시 파워: `100.01 PiB` (요구사항 기준값)
- 목표 일당 당첨금: `380 FIL`
- 목표 총판매금: `760 FIL`
- 티켓 기준가: `760 / 2880 = 0.263888... FIL`
- 확정 판매가: `0.27 FIL` (올림 적용)

### 4.2 상품 B
- 마이너: `f03081952`
- 표시 파워: `50.08 PiB` (요구사항 기준값)
- 최근 3개월 평균(조회시점 기준) 순채굴량: `195.385114 FIL/24h`
- 목표 총판매금(2R 규칙): `390.770228 FIL`
- 티켓 기준가: `390.770228 / 2880 = 0.135684... FIL`
- 확정 판매가: `0.14 FIL` (반올림 적용)

### 4.3 공통 본전 기준
- 공식: `참여티켓수 * 티켓가 >= 일당 당첨금`
- 위 가격 산식(총판매=2R) 사용 시 본전 최소 유저 티켓수는 고정적으로 `1440`
- 운영 규칙:
  - `U < 1440` -> 취소
  - `U >= 1440` -> 진행 + 플랫폼 자동채움

## 5) 라운드 일정 및 상태
### 5.1 기본 시간축 (UTC, 체인 기준)
- 판매창: D일 00:00 ~ D+1일 00:00
- 관측창: D+1일 00:00 ~ D+2일 00:00
- 집계: D+2일 00:00
- 발표/정산 반영: D+2일 00:30 (안정성 대기 30분)

### 5.2 시간대 정책
- 기준 시간대는 `UTC`로 고정한다.
- Filecoin 블록 헤더 `Timestamp`는 Unix timestamp(초) 기준으로 처리한다.
- 앱 UI는 사용자 가독성을 위해 KST 병기 가능하나, 정산/검증의 기준값은 UTC만 사용한다.
- 참고:
  - Filecoin Spec (Block Producer / Timestamp): `Timestamp - a Unix timestamp, in seconds`
  - Filecoin Spec (Clock): `epoch = Floor[(current_time - genesis_time) / epoch_time]`

### 5.3 상태값
- `SELLING`: 판매중
- `CANCELLED`: 취소(1440 미만)
- `OBSERVING`: 관측중
- `COMPLETED`: 완료(집계+정산 종료)

### 5.4 일자별 이력 화면 요구
- 각 상품별로 날짜 리스트 제공
- 각 날짜에 `완료/취소` 뱃지 표시
- `완료` 항목 클릭 시 상세 진입

## 6) 입금 기능 요구사항
### 6.1 사용자 흐름
1. 사용자 `입금` 클릭
2. 개인 입금주소 표시
3. 외부 지갑에서 FIL 전송
4. 사용자 txid 입력 후 `입금확인` 요청
5. 서버가 자동 검증 후 잔고 반영

### 6.2 txid 자동 검증 규칙
- 체인 상 tx 존재 여부
- 수신 주소 일치 여부(해당 회원 입금주소)
- 코인/네트워크 일치 여부(Filecoin mainnet)
- 최소 컨펌 충족 여부
- 중복 처리 방지(txid unique)

### 6.3 입금 상태
- `PENDING_USER_INPUT`
- `VERIFYING`
- `CONFIRMED`
- `REJECTED`

## 7) 출금 기능 요구사항
### 7.1 사용자 흐름
1. 출금 주소 + 수량 입력
2. 수수료/실수령액 확인
3. 출금 요청
4. 처리상태 확인

### 7.2 수수료 처리
- `실수령액 = 출금요청액 - 출금수수료`
- 출금수수료는 체인에서 실제 소모된 전송 수수료(`on-chain actual fee`)와 동일해야 한다.
- 출금 요청 시점에는 예상 수수료를 먼저 표시하고, 전송 확정 후 실제 수수료로 최종 정산한다.
- 최소 출금액/일일 한도는 운영 파라미터로 관리

### 7.3 출금 상태
- `REQUESTED`
- `QUEUED`
- `SENT`
- `CONFIRMED`
- `FAILED`

## 8) 잔고 표시 정책
앱 화면에서 아래를 동시에 표시한다.
- 입금 잔고 (`deposit_balance`)
- 당첨금 잔고 (`winnings_balance`)
- 총 출금가능 잔고 (`total_available = deposit + winnings - lock`)

출금 화면에서는 분리잔고를 보여주되, 최종 출금 가능 총액도 함께 표기한다.

## 9) 로터리 참여 및 티켓 배정
### 9.1 참여 수량 입력
- 사용자 입력값 `n`(1 이상)
- n개 티켓을 한 트랜잭션으로 발급

### 9.2 랜덤 티켓 배정
- 풀: `1..2880`
- 남은 티켓 중 무작위 n개 배정
- 중복 불가(유저 내/라운드 전체)
- 배정 완료 즉시 사용자에게 티켓번호 목록 반환

### 9.3 권장 공정성(가정)
- 서버 시드 커밋-리빌 구조 적용 권장
- 라운드 종료 후 시드 공개로 사후 검증 가능

## 10) 취소/자동채움 규칙
### 10.1 취소
- 판매마감 시 유저 판매수량 `U < 1440`
- 라운드 상태 `CANCELLED`
- 유저 결제금 내부잔고 즉시 환불

### 10.2 진행 + 자동채움
- `U >= 1440`
- 남은 수량 `2880-U`를 플랫폼 계정으로 자동 채움
- 이후 관측/집계 정상 진행

## 11) 당첨 판정 및 결과 공개
### 11.1 판정 규칙
- 관측구간의 2880 epoch를 인덱스 1~2880으로 매핑
- `티켓 i <-> epoch i`
- 지정 마이너가 epoch i에서 블록 생성 성공 시 티켓 i 당첨

### 11.2 엣지케이스
- 해당 epoch에 블록이 없으면(Null epoch) 비당첨
- 같은 epoch에 동일 마이너 블록 다수여도 티켓 i는 1회 당첨

### 11.3 결과 상세 화면(완료 라운드)
- 당첨 번호 목록(예: 7, 18, 105, ...)
- 총 당첨 수량(예: 83개)
- 사용자 본인 당첨 개수
- 지급 반영 내역
- 증빙 링크(익스플로러)

### 11.4 증빙 링크 포맷
- Tipset: `https://filfox.info/en/tipset/{height}`
- Block: `https://filfox.info/en/block/{cid}`

요구사항:
- 당첨 번호마다 최소 1개 이상의 증빙 링크 제공
- 링크 클릭 시 해당 마이너 블록 존재를 확인 가능해야 함

## 12) 랜딩페이지 요구사항 (APK 전용)
- 간단 소개(서비스 개념/2개 노드 상품)
- 최신 APK 다운로드 버튼
- 버전/빌드/용량/SHA-256 표시
- 설치 가이드
- 라운드 공개 결과 링크(완료/취소 이력 페이지 진입)

## 13) API 초안
### 13.1 사용자
- `POST /auth/signup`
- `POST /auth/login`
- `GET /wallet/balance`
- `GET /wallet/deposit-address`
- `POST /wallet/deposits/verify-txid`
- `POST /wallet/withdrawals`
- `GET /wallet/transactions`

### 13.2 로터리
- `GET /lotteries/products`
- `GET /lotteries/{productId}/rounds?date=YYYY-MM-DD`
- `POST /lotteries/{productId}/rounds/{roundId}/join` (qty 포함)
- `GET /lotteries/{productId}/rounds/{roundId}/tickets/me`
- `GET /lotteries/{productId}/rounds/{roundId}/result`

### 13.3 공개 검증
- `GET /public/rounds/{roundId}/status`
- `GET /public/rounds/{roundId}/winners`
- `GET /public/rounds/{roundId}/proofs`

## 14) DB 핵심 모델
- `users`
- `wallet_accounts`
- `wallet_ledger`
- `deposit_requests`
- `withdrawal_requests`
- `lottery_products`
- `lottery_rounds`
- `tickets`
- `epoch_observations`
- `winners`
- `winner_proofs`

핵심 제약:
- `tickets(round_id, ticket_no)` unique
- `deposit_requests(txid)` unique
- `winner_proofs(round_id, ticket_no, block_cid)` unique

## 15) 운영 파라미터
- 상품별 티켓가격
- 최소 진행 티켓수(기본 1440)
- 출금수수료 정책(고정값 아님, 체인 실수수료 동기화)
- 최소 출금액
- 자동채움 사용 여부
- 결과 집계/발표 스케줄

## 16) 오픈 의사결정 항목
1. 없음 (현재 정책 확정)

## 17) 가정(명시)
- 본 문서의 상품 B 평균값(`195.385114 FIL/24h`)은 2026-05-09 KST 기준 최근 3개월 데이터로 계산한 값이다.
- 노드의 채굴량/네트워크 상태는 시간에 따라 변동될 수 있다.
- 상품별 티켓가격은 운영자가 주기적으로 재산정할 수 있다.

---

## 中文摘要
- 本文档定义了双节点彩票产品：`f01083914` 与 `f03081952`。
- 用户流程：注册 -> 显示余额 -> 充值地址 -> 链上转账 -> 输入 txid -> 系统自动校验后入账。
- 余额需分开展示“充值余额/中奖余额”，提现页面同时展示总可提现余额。
- 购票支持输入数量，系统从 1~2880 中随机分配且不重复。
- 若用户购票数少于 1440，则该日轮次取消并退款；达到 1440 则继续并由平台补齐至 2880。
- 票价已固定：100P 产品 0.27 FIL，50P 产品 0.14 FIL。
- 时间基准固定为 UTC；UI 可并行展示 KST。
- 结果发布时间为 UTC 00:30（UTC 00:00 完成集计后等待 30 分钟）。
- 提现手续费与链上实际手续费保持一致。
- 完成轮次需提供：中奖号码、中奖数量、以及区块浏览器证明链接。

---

## English Summary
- This spec defines two lottery products based on miners `f01083914` and `f03081952`.
- User flow: sign up -> view FIL balances -> get deposit address -> send FIL -> submit txid -> auto verify -> credit balance.
- Balances must be split into deposit vs winnings, while withdrawal screen also shows total available.
- Ticket purchase supports quantity input, with random non-duplicated allocation from 1..2880.
- If sold tickets are below 1440, round is cancelled and refunded; if 1440 or more, round proceeds and platform auto-fills to 2880.
- Fixed prices: 0.27 FIL for the 100P product, 0.14 FIL for the 50P product.
- Canonical time base is UTC (KST can be shown in UI as secondary display).
- Result publication is fixed at 00:30 UTC (30-minute stability buffer after 00:00 UTC aggregation).
- Withdrawal fee must match actual on-chain transfer fee.
- Completed round details must show winning numbers, total winner count, and explorer proof links.
