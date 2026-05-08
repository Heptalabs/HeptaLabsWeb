# IMWallet 배포 후 스모크 테스트 체크리스트 (2026-04-30)

## 목적
- 배포 직후 핵심 화면/핵심 기능의 치명 회귀를 빠르게 검출

## 사전 준비
1. 앱
- 실행: `cd imwallet-app && npm run web`
- URL: `http://localhost:8081`

2. 백엔드
- 실행: `cd backend && npm run dev`
- API base: `http://localhost:4000`

3. 점검 환경
- 브라우저 모바일 뷰: `400 x 669` 기준
- 라이트/다크 모드 둘 다 확인
- 한국어/영어/중국어 최소 1회 전환 확인

## A. 공통 안정성
1. 앱 진입
- 크래시 화면 미노출
- 오류가 나도 raw 에러 문자열(`undefined is not a function`) 직접 노출 금지

2. 네비게이션
- 하단 탭 이동(홈/보내기/기록/둘러보기) 정상
- 뒤로가기 버튼 동작 정상

## B. 드롭다운/딤 정책
정책 기준:
- 헤더+본문 단일 딤
- 활성 트리거 + 활성 드롭다운만 딤 제외
- 나머지 영역 딤 + 클릭 차단
- 딤 클릭 시 닫힘

대상 화면:
1. 홈
- 지갑 선택
- 레이아웃
- 스캔

2. 보내기(자산)
- 주소록
- 스캔
- 주소 저장
- 최근 전송

3. 보내기(NFT)
- 주소록
- 스캔
- 주소 저장
- 최근 전송

4. 기록
- 기간
- 날짜 선택

5. 설정
- 언어

6. 주소록 관리
- 수정 시트

## C. 둘러보기
1. 상단 카드
- 항상 `IMWallet 주간 브리핑` 카드 노출
- CoinDesk/PancakeSwap가 상단 대표 카드로 노출되면 실패

2. DApps 카테고리
- 전체/디파이/거래소/NFT 컬렉션/소셜/게임
- 각 카테고리에서 10개 충족(실데이터+fallback 정책)

3. 인기 토큰
- 시총 순 정렬 유지
- 아이콘 로딩 실패 다발 여부 확인

4. 사이트
- 목록 노출 정상
- 즐겨찾기 추가/해제 정상

## D. 백엔드 운영 점검
1. provider 연결
- `cd backend && npm run check:providers`
- warn 발생 시 사유 기록

2. DApp 카테고리 보장
- `cd backend && npm run check:dapps:categories`
- PASS 확인

3. DappRadar 실연동 상태
- 미설정이면 warn: `project_id_missing` 정상
- 실연동 목표 시 필수 설정:
  - `DAPPRADAR_API_KEY`
  - `DAPPRADAR_PROJECT_ID` 또는 `DAPPRADAR_TOP_DAPPS_ENDPOINT`

## E. 최종 판정
1. Blocker
- 앱 크래시 재현
- 딤 정책 위반(클릭 차단 실패, 단일딤 붕괴)
- 둘러보기 상단 카드가 IMWallet 브리핑이 아닌 경우

2. Non-blocker
- 외부 아이콘 지연/일시 로드 실패
- provider warn(단, fallback 정상 동작 시)

3. 배포 승인 기준
- Blocker 0건
- 핵심 흐름(A~D) 통과

---

## 中文摘要
- 重点检查：崩溃暴露、下拉遮罩一致性、Discover 顶部卡片固定为 IMWallet 周报。
- DApp 分类需满足每类 10 条（实时+fallback）。

## English Summary
- Focus areas: crash-message safety, unified dim/dropdown policy, and fixed IMWallet Weekly Briefing top card.
- DApp categories must satisfy 10 rows per category via live+fallback policy.
