# IMWALLET_PHASE_PLAN

KR | [中文](#中文) | [English](#english)

## KR

## 1) 문서 목적
이 문서는 IMWallet 개발을 **1기(서비스 시작 범위)** 와 **2기(확장 범위)** 로 분리해 운영하기 위한 확정 기준서다.

기준일: 2026-05-01 (KST)

## 2) 확정 원칙
- 1기 완료 전에는 2기 범위 개발을 병행하지 않는다.
- 1기는 “현재 앱에 존재하는 체인/자산/NFT”의 송수신 실사용 안정화에 집중한다.
- 1기 완료 후 2기를 시작한다.

## 3) 1기 범위 (서비스 시작)
### 3.1 목표
- 앱에 이미 포함된 체인/자산/NFT에 대해 보내기/받기를 실사용 가능 상태로 만든다.

### 3.2 포함 범위
- 체인: `BTC`, `ETH`, `XRP`, `BSC`, `SOL`, `TRX`, `FIL`
- 자산:
  - 네이티브: `BTC`, `ETH`, `XRP`, `BNB(BSC)`, `SOL`, `TRX`, `FIL`
  - 토큰: `USDT(ETH/BSC/TRX)`
- NFT:
  - 앱에 현재 탑재된 체인/컬렉션 범위 내 송수신 (추가 체인/표준 확장은 2기)

### 3.3 1기 완료 기준 (Definition of Done)
- 보내기:
  - 위 범위에서 체인별 메인넷 송금 성공 및 트랜잭션 해시 확인
  - 수수료/논스/에러 처리 정상 동작
- 받기:
  - 외부 지갑에서 입금 시 잔액 반영 및 히스토리 반영
- 보안:
  - 비밀번호/생체 인증 정책에 따라 민감 액션 보호
- 품질:
  - 빌드/타입체크/기본 테스트 통과
  - 체인 조회 스모크(holders/provider) 통과

### 3.4 1기 제외 범위
- 일반 토큰 전체 지원(임의 ERC20/TRC20/SPL 등)
- NFT 전 체인/전 표준 확대
- 스왑/브릿지/스테이킹/고급 리스크 엔진 확장

## 4) 2기 범위 (확장)
### 4.1 목표
- Trust Wallet 레퍼런스 수준의 다중 체인/다중 자산 확장 구조로 전환한다.

### 4.2 포함 항목
- 일반 토큰 확장:
  - EVM 전반 ERC20
  - TRON TRC20 일반화
  - Solana SPL/Token-2022 등
- NFT 확장:
  - ERC-721/1155, Solana NFT, 기타 지원 체인 표준 확대
- 체인 어댑터/인덱서/모니터링 고도화
- 장애 대응, provider failover, 운영 자동화 강화

### 4.3 2기 시작 조건
- 1기 완료 기준 전부 충족
- 1기 배포 후 운영 안정성 점검(핵심 이슈 미해결 항목 없음)

## 5) 운영 규칙
- 신규 기능 요청이 들어와도 1기 범위 바깥이면 2기 백로그로 분류한다.
- 서비스 오픈 직전 변경은 1기 안정성에 영향 없을 때만 반영한다.

---

## 中文

### 摘要
- 开发分为两期：
  - **1期**：仅聚焦当前应用内已存在链/资产/NFT 的收发能力，并达到可实用上线质量。
  - **2期**：在 1期完成后，扩展到通用代币与更完整的 NFT/多链能力。
- 1期未完成前，不并行推进 2期范围。

### 1期范围（固定）
- 链：BTC, ETH, XRP, BSC, SOL, TRX, FIL
- 资产：原生资产 + USDT(ETH/BSC/TRX)
- NFT：仅当前应用已内置范围

### 2期方向
- 通用 ERC20/TRC20/SPL 扩展
- NFT 标准与链覆盖扩展
- 适配层、索引、监控与容灾能力增强

---

## English

### Summary
- Development is split into two phases:
  - **Phase 1**: launch readiness for send/receive on currently included chains/assets/NFT scope only.
  - **Phase 2**: broader expansion toward Trust Wallet-like multi-chain and multi-asset coverage.
- No parallel Phase 2 development before Phase 1 completion.

### Phase 1 fixed scope
- Chains: BTC, ETH, XRP, BSC, SOL, TRX, FIL
- Assets: native coins + USDT on ETH/BSC/TRX
- NFT: only currently in-app supported scope

### Phase 2 direction
- General token expansion (ERC20/TRC20/SPL)
- Broader NFT standards/chains
- Adapter/indexer/monitoring/failover hardening

