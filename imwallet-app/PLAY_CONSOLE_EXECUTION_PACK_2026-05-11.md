# IMWallet Play Console Execution Pack (2026-05-11)

이 문서는 **코드 수정 완료 이후**, Play Console에서 사람이 직접 수행해야 하는 항목을 한 번에 처리하기 위한 실행본입니다.

## 0) 현재 기준 산출물(완료)
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- AAB SHA-256: `f02b806f0865b6ec34c293e61e521f8fb054428c9a9ea88825776b004b8b67bc`
- Upload key alias: `upload`
- Upload key SHA-256: `35:D5:00:F2:1C:84:3E:F4:47:31:A5:8D:E9:85:02:81:39:2A:20:D4:12:F6:2F:FF:EF:87:8E:2B:D5:A5:16:C1`
- Gate check: `scripts/preflight-release-gate-22.sh` PASS

## 1) Play Internal Track 업로드
1. Play Console > 앱 선택 > `Release` > `Testing` > `Internal testing`
2. `Create new release`
3. `app-release.aab` 업로드
4. Release notes 입력(아래 문구 사용 가능)

### Release Notes (KO)
보안 하드닝 및 릴리스 서명 체인 정비.
공개 시드/데모 지갑/외부 QR 위탁 경로 제거,
Android 권한/Network Security Config 정비,
AAB 릴리스 서명 검증 완료.

### Release Notes (EN)
Security hardening and release-signing pipeline stabilization.
Removed public-seed/demo-wallet/external-QR paths,
updated Android permissions and network security config,
and verified signed release AAB.

## 2) Data Safety 제출 (Play Console)
경로: `Policy and programs` > `App content` > `Data safety`

아래는 **현재 코드 기준 권장값**입니다.

### 2.1 상위 질문
- Does your app collect or share any required user data types?: **Yes**
- Is all user data encrypted in transit?: **Yes**
- Do you provide a way for users to request data deletion?: **Yes** (지원 이메일/정책 페이지에 경로 명시)

### 2.2 데이터 카테고리(권장)
1. Personal info > User IDs
- Collected: **Yes**
- Shared: **Yes** (체인 RPC/외부 네트워크 요청에서 주소 계열 식별자 전송 가능)
- Purpose: **App functionality**, **Security/Fraud prevention**

2. Financial info > Transaction history
- Collected: **Yes**
- Shared: **Yes** (체인 브로드캐스트/RPC 조회)
- Purpose: **App functionality**

3. App activity > App interactions
- Collected: **Yes** (Discover 상호작용 로그)
- Shared: **No** (1st-party backend 저장 기준)
- Purpose: **Analytics**, **App functionality**

4. Device or other IDs
- Collected: **No** (현재 구현 기준)

5. Location / Contacts / Audio / Messages
- **No**

6. Photos and videos / Files and docs
- 기본값: **No**
- 단, 실제 운영에서 업로드/첨부 기능으로 서버 전송을 켠 경우 해당 항목을 **Yes**로 갱신 필요

## 3) 개인정보처리방침 URL 연결
경로: `Store presence` > `Store settings` 또는 `App content`의 정책 URL 항목

- 권장 URL: `https://download.imwallet.app/download/privacy.html`
- 정책 문서에는 반드시 포함:
  - 비커스터디 모델(시드/프라이빗키 서버 미보관)
  - 외부 RPC 전송 항목(주소/트랜잭션 메타)
  - 데이터 삭제 요청 채널(이메일/폼)

## 4) IARC 설문 제출
경로: `Policy and programs` > `App content` > `Content rating`

권장 응답 요약:
- 폭력/선정성/도박/약물: **No**
- Real-money financial transfer: **Yes**
- Unrestricted internet access/web browsing(dApp 브라우저): **Yes**
- 사용자간 공개 커뮤니티/채팅: **No**

## 5) 실기기 스모크 테스트(출시 전 필수)
- BTC/ETH/XRP/BSC/SOL/TRX/FIL 송수신 각 1회(소액)
- 시드 상호복구(IMWallet <-> 외부 호환 지갑) 검증
- 잠금/비밀번호/생체 인증 시나리오 확인
- 실패 시 Internal track 롤아웃 중지

## 6) 최종 게시 전 체크
1. Internal track 설치/실행 정상
2. 크래시/화이트스크린 없음
3. Data Safety, Privacy URL, IARC 모두 `Submitted` 상태
4. 이후 `Open testing` 또는 `Production` staged rollout 진행
