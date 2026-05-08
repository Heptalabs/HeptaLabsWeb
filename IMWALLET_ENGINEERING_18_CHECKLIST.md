# IMWallet 엔지니어링 18개 항목 점검표

기준일: 2026-04-17 (KST)

## KR

아래 18개는 “개발/코딩 관점에서 실서비스 운영 준비” 기준으로 현재 코드에 매핑한 점검표입니다.

1. 앱 도메인 타입/체인 규칙 분리: 완료  
   - `imwallet-app/src/domain/wallet-domain.ts`
2. 주소 검증 엔진(형식/체인 불일치/존재 검증): 완료  
   - `imwallet-app/src/services/addressEngine.ts`
3. 송금 입력/드래프트 엔진(금액 파싱, 잔액 검증): 완료  
   - `imwallet-app/src/services/sendFlowEngine.ts`
4. 지갑 상태 저장소(멀티지갑, 선택 지갑 persist): 완료  
   - `imwallet-app/src/state/useWalletStore.ts`
5. 자산 토글 저장소(온/오프 persist): 완료  
   - `imwallet-app/src/state/useAssetToggleStore.ts`
6. 보안 스토리지 추상화(웹/모바일 분기): 완료  
   - `imwallet-app/src/services/secureStore.ts`
7. 구조화 로깅 버퍼: 완료  
   - `imwallet-app/src/services/logger.ts`
8. 모니터링 연동(부팅/송금 성능, 에러 추적): 완료  
   - `imwallet-app/src/services/monitoring.ts`  
   - `imwallet-app/App.tsx`
9. QR 공유 유틸(수신 주소 QR/공유 메시지): 완료  
   - `imwallet-app/src/services/qrShare.ts`
10. 수신 화면 컴포넌트 분리: 완료  
   - `imwallet-app/src/components/receive/ReceiveQrCard.tsx`
11. i18n 레이아웃 제약 유틸 + 테스트: 완료  
   - `imwallet-app/src/i18n/layoutConstraints.ts`  
   - `imwallet-app/src/i18n/layoutConstraints.test.ts`
12. 콘솔 타입 시스템/세션 모델: 완료  
   - `imwallet-console/src/types/admin.ts`
13. 콘솔 인증 컨텍스트(비밀번호+MFA): 완료  
   - `imwallet-console/src/auth/AuthContext.tsx`
14. 콘솔 서버 검증/리스크 룰: 완료  
   - `imwallet-console/src/server/validators.ts`  
   - `imwallet-console/src/server/riskRules.ts`
15. 콘솔 Mock API(대시보드/정책/한도/검증): 완료  
   - `imwallet-console/src/server/mockApi.ts`
16. RBAC 접근 제어 분리(역할별 메뉴 접근): 완료  
   - `imwallet-console/src/security/accessControl.ts`  
   - `imwallet-console/src/App.tsx`
17. 테스트 체계(앱/콘솔 핵심 모듈): 완료  
   - `imwallet-app/src/services/*.test.ts`  
   - `imwallet-console/src/server/*.test.ts`  
   - `imwallet-console/src/security/accessControl.test.ts`
18. CI 자동 검증(app+admin typecheck/test/build): 완료  
   - `.github/workflows/imwallet-ci.yml`

## 中文 (摘要)

- 已按“工程实现”维度完成 18 项，并在文档中给出每项对应代码路径。  
- 重点补齐项：监控接入（性能+错误）与 RBAC 访问控制单元测试。  
- CI 已覆盖 app/console 的 typecheck、test、build。

## English (Summary)

- All 18 engineering items are mapped to concrete implementation files.  
- Newly closed gaps: app monitoring integration (perf + errors) and RBAC unit coverage.  
- CI now validates app/console typecheck, tests, and builds.
