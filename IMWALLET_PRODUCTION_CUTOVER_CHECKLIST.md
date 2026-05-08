# IMWallet 운영 전환 최종 체크리스트

## KR

### A. 환경/보안
- [ ] `backend/.env.production` 생성 및 운영 DB 주소 반영
- [ ] `backend/.env.production.keys` 생성 (`npm run set:prod-keys`, `npm run set:prod-keys:env`, 또는 `npm run set:prod-keys:keychain`)
- [ ] macOS 운영 환경이라면 키체인 등록 완료 (`npm run set:keychain-keys:env`)
- [ ] `JWT_SECRET` 32자 이상 강한 랜덤값 사용
- [ ] `NODE_ENV=production` 확인
- [ ] `DISCOVER_ENFORCE_HTTPS=true` 확인

### B. 백엔드 점검
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
npm run check:prod-env
npm run check:providers
npm run preflight:prod
```
- 사후 연동 점검:
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
npm run smoke:post-cutover -- http://127.0.0.1:4000/api/v1 .env.production
```

### C. 엄격 점검(컷오버 직전 필수)
```bash
cd "/Users/heptalabs/Documents/New project/SJK/backend"
npm run preflight:prod:strict
```
- 통과 기준:
  - 필수 env + 권장 key 모두 존재
  - keyed provider 연결 성공
  - holders/content smoke 100% 통과

### D. 앱/콘솔 빌드 점검
```bash
cd "/Users/heptalabs/Documents/New project/SJK/imwallet-app"
npm run typecheck && npm run test:run && npm run build:web

cd "/Users/heptalabs/Documents/New project/SJK/imwallet-console"
npm run typecheck && npm run test:run && npm run build
```
- 콘솔 운영 env 확인:
  - [ ] `VITE_USE_MOCK_API=false`
  - [ ] `VITE_BACKEND_BASE_URL=https://<api-domain>`

### E. 운영 전환 후 즉시 확인
- [ ] `GET /api/v1/health` 정상
- [ ] 둘러보기 인기토큰/디앱/사이트 API 응답 정상
- [ ] 전송/수신/기록 플로우 정상
- [ ] 다국어(한/영/중) 레이아웃 깨짐 없음
- [ ] 라이트/다크 토글 시 UI 위치 변동 없음

### F. 롤백 준비
- [ ] 이전 배포 버전/이미지 태그 보관
- [ ] DB 백업 시점 기록
- [ ] 장애 시 롤백 명령/담당자/연락체계 문서화
- [ ] `npm run db:backup` / `npm run db:restore:rehearsal` 1회 이상 검증
- [ ] 로컬 DB 도구 미설치 환경이면 `npm run db:rehearsal:embedded -- .env.production` 통과

### G. 통합 실행
- [ ] [IMWALLET_CUTOVER_RUNBOOK.md](/Users/heptalabs/Documents/New%20project/SJK/IMWALLET_CUTOVER_RUNBOOK.md) 기준으로 전체 리허설 완료
- [ ] `bash ./scripts/imwallet-cutover-check.sh` 통과

---

## 中文 (摘要)
- 先配置 `backend/.env.production` 与 `backend/.env.production.keys`
- 运行：`npm run check:prod-env && npm run check:providers && npm run preflight:prod`
- 正式切换前必须运行：`npm run preflight:prod:strict`
- 切换后检查 health、Discover 数据、转账流程、多语言与主题 UI

## English (Summary)
- Prepare `backend/.env.production` and `backend/.env.production.keys`
- Run: `npm run check:prod-env && npm run check:providers && npm run preflight:prod`
- Before cutover, run strict: `npm run preflight:prod:strict`
- After cutover, verify health, Discover feeds, transfer flow, i18n, and theme UI consistency
