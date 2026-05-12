# IMWallet Play Console Release Checklist (Items 17-22)

## 17) Release AAB Build + Signing Verification
Status: DONE (2026-05-11)
1. Upload-key env vars 준비:
   - `IMWALLET_UPLOAD_STORE_FILE`
   - `IMWALLET_UPLOAD_STORE_PASSWORD`
   - `IMWALLET_UPLOAD_KEY_ALIAS`
   - `IMWALLET_UPLOAD_KEY_PASSWORD`
2. 사전 점검:
   - `npm run preflight:release:security`
3. AAB 빌드:
   - `eas build -p android --profile production`
4. 산출물 확인:
   - `.aab` 생성 여부
   - Play Console Internal track 업로드 가능 여부
5. Local bundleRelease + jarsigner verify:
   - PASS (`app-release.aab`, SHA-256: `f02b806f0865b6ec34c293e61e521f8fb054428c9a9ea88825776b004b8b67bc`)

## 18) Play Console Data Safety 작성
Status: PENDING (Console 작업)
- 수집/처리 항목, 제3자 전송처, 암호화 전송 여부, 삭제 요청 경로 작성
- 실제 구현 기준으로만 기입 (과장/누락 금지)

## 19) Privacy Policy URL 연결
Status: PENDING (Console 작업)
- 공개 URL 준비 (`https://.../privacy`)
- Play Console 앱 정보에 연결
- 앱 내 설정 > 정보 메뉴에도 동일 URL 노출 권장

## 20) IARC 설문 완료
Status: PENDING (Console 작업)
- Play Console > Content rating(IARC) 설문 제출
- 결과 등급 확인 후 출시국 정책과 정합성 재확인

## 21) 실기기 스모크 테스트
Status: PENDING (실기기 작업)
- 7체인 송/수신 소액 테스트
- 잠금/비밀번호/생체인증(지문/얼굴) 시나리오 테스트
- 시드 상호복구(Trust Wallet ↔ IMWallet) 재확인

## 22) 배포 전 최종 보안 게이트
Status: DONE (2026-05-11)
1. 자동:
   - `npm run preflight:release:security`
2. 수동 추가 확인:
   - Debug keystore 미사용
   - `DEFAULT_COMPAT_SEEDS` 잔존 없음
   - `clipboard-read/write` 잔존 없음
   - 외부 QR 위탁(`api.qrserver.com`) 잔존 없음
