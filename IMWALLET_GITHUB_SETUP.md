# IMWALLET_GITHUB_SETUP

KR | [中文](#中文) | [English](#english)

## KR

## 1) 문서 목적
이 문서는 `heptalabs/imwallet` 저장소를 기준으로 브랜치 전략, 스테이징 운영, GitHub Actions 자동 빌드/배포 기준을 고정하기 위한 실행 문서다.

## 2) 대상 저장소
- 조직/리포지토리: `heptalabs/imwallet`
- 기본 브랜치: `main`
- 배포 단계:
  - `develop`: 통합 개발
  - `staging`: 스테이징 검증
  - `main`: 정식 출시

## 3) 브랜치 전략

| 브랜치 | 역할 | 병합 규칙 |
|---|---|---|
| `develop` | 기능 통합/일상 개발 | `feature/*` PR만 허용 |
| `staging` | QA/사전 릴리즈 검증 | `develop -> staging` PR만 허용 |
| `main` | 운영 릴리즈 | `staging -> main` PR만 허용 |
| `feature/*` | 기능 작업 | 완료 후 `develop`으로 PR |
| `hotfix/*` | 긴급 운영 수정 | `main` 기준 생성 후 `main`/`develop` 동시 반영 |

권장 흐름:
1. 기능 개발: `feature/* -> develop`
2. 스테이징 배포: `develop -> staging`
3. 운영 배포: `staging -> main` + `vX.Y.Z` 태그

## 4) 브랜치 보호 규칙

### `main`
- Force push 금지, 삭제 금지
- 최소 승인 2명
- Code owner review 필수
- 최신 브랜치 재검증(Require branches to be up to date)
- 필수 체크:
  - `Mobile CI / android-ci`
  - `Mobile CI / ios-ci`
  - `Mobile CI / rust-core-ci`

### `staging`
- Force push 금지, 삭제 금지
- 최소 승인 1명
- 필수 체크:
  - `Mobile CI / android-ci`
  - `Mobile CI / ios-ci`
  - `Mobile CI / rust-core-ci`
  - `Staging Build / android-staging`

### `develop`
- Force push 금지
- 최소 승인 1명
- 필수 체크:
  - `Mobile CI / android-ci`
  - `Mobile CI / ios-ci`
  - `Mobile CI / rust-core-ci`

## 5) GitHub Environments

| Environment | 브랜치 | 목적 |
|---|---|---|
| `staging` | `staging` | 내부 QA 빌드 배포 |
| `production` | `main` | 앱스토어/플레이스토어 릴리즈 |

필수 시크릿(초안):
- 공통: `SENTRY_AUTH_TOKEN`, `SLACK_WEBHOOK_URL`
- Android: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `FIREBASE_APP_ID_ANDROID`, `FIREBASE_TOKEN`, `PLAY_SERVICE_ACCOUNT_JSON`
- iOS: `APPSTORE_CONNECT_KEY_ID`, `APPSTORE_CONNECT_ISSUER_ID`, `APPSTORE_CONNECT_PRIVATE_KEY`, `IOS_CERT_P12_BASE64`, `IOS_CERT_PASSWORD`, `IOS_PROFILE_BASE64`

## 6) GitHub Actions 구성
- 템플릿 위치: `templates/imwallet/.github/workflows/`
- 포함 파일:
  - `mobile-ci.yml`: PR/Push 기본 품질검사
  - `staging-build.yml`: `staging` 푸시 시 Android/iOS 스테이징 빌드
  - `release.yml`: 태그(`v*`) 또는 수동 실행 기준 릴리즈 파이프라인

## 7) 초기 세팅 실행 순서
1. `templates/imwallet/scripts/setup-github-repo.sh` 실행
2. `templates/imwallet/scripts/apply-branch-protection.sh` 실행
3. 템플릿 워크플로를 실제 저장소 `.github/workflows/`로 복사
4. `staging`, `production` Environment와 시크릿 등록
5. 샘플 PR로 필수 체크 통과 확인

## 8) 스테이징 운영 (맥 기반)
- 개발은 맥 로컬(에뮬레이터/시뮬레이터) 중심으로 진행
- 기능 단위 완료 시 `staging`으로 올려 자동 빌드 산출물 확인
- 실기기 점검은 스테이징 빌드(APK/TestFlight internal)로 수행
- 운영 전환은 `main` 태그 릴리즈 기반으로 수행

---

## 中文

### 摘要
- 仓库使用 `develop -> staging -> main` 三阶段分支流。
- `main` 需要更严格保护（至少 2 人审批 + 必需 CI 检查）。
- 已提供可直接复用的 GitHub Actions 模板与脚本：
  - `templates/imwallet/.github/workflows/`
  - `templates/imwallet/scripts/`
- 开发主要在 Mac 本地完成，阶段性通过 `staging` 生成 Android/iOS 测试构建，最终从 `main` 打标签发布。

---

## English

### Summary
- Branch model: `develop -> staging -> main` with feature/hotfix side branches.
- `main` has the strictest protections (2 approvals + required CI checks).
- Ready-to-copy templates are included:
  - `templates/imwallet/.github/workflows/`
  - `templates/imwallet/scripts/`
- Day-to-day development runs on Mac locally; staging builds validate device-ready packages before production tag releases.
