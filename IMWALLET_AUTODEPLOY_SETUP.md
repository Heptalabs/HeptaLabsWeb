# IMWALLET 자동 반영 세팅 가이드

## 목표
- 내가 명령하면 Codex가 코드 수정
- GitHub 반영(커밋/푸시)
- GitHub 반영 후 서버/앱 자동 반영

## 구성 요약
- Backend CD: `.github/workflows/imwallet-backend-cd.yml`
- Console CD: `.github/workflows/imwallet-console-cd.yml`
- Download Landing CD: `.github/workflows/imwallet-download-cd.yml`
- App OTA: `.github/workflows/imwallet-app-ota.yml`
- App Native Build(수동): `.github/workflows/imwallet-app-native-build.yml`
- Deploy scripts:
  - `scripts/imwallet-cd/deploy-backend-via-jump.sh`
  - `scripts/imwallet-cd/deploy-console-via-jump.sh`
  - `scripts/imwallet-cd/deploy-download-page-via-jump.sh`
  - `scripts/imwallet-cd/imwallet-publish.sh`

## 앱 재설치가 필요한 경우
- 재설치 불필요:
  - 화면/UI/비즈니스 로직 등 JS/TS 변경
  - OTA(Expo EAS Update)로 즉시 반영 가능
- 재설치 필요:
  - 네이티브 변경(플러그인/권한/SDK/네이티브 모듈)
  - 이 경우 `IMWallet App Native Build` 워크플로로 빌드 후 설치

## GitHub Secret / Variable 설정

### Secrets
- `IMWALLET_JUMP_SSH_PRIVATE_KEY`
  - 점프서버 접속 가능한 개인키(멀티라인 원문)
- `EXPO_TOKEN`
  - Expo/EAS 토큰

### Variables
- `IMWALLET_JUMP_HOST` = `121.140.83.207`
- `IMWALLET_JUMP_PORT` = `2222`
- `IMWALLET_JUMP_USER` = `vm`
- `IMWALLET_APP_HOST` = `192.168.1.167`
- `IMWALLET_APP_USER` = `vm`
- `IMWALLET_APP_PORT` = `22`
- `IMWALLET_BACKEND_SERVICE` = `imwallet-backend`
- `IMWALLET_BACKEND_HEALTH_URL` = `http://127.0.0.1:4000/api/v1/health`
- `IMWALLET_CONSOLE_TARGET_PATH` = `/opt/imwallet/console-dist` (운영 경로에 맞게 조정)
- `IMWALLET_CONSOLE_RESTART_SERVICE` = `nginx` (필요 시)
- `IMWALLET_DOWNLOAD_DOMAIN` = `download.imwallet.app`
- `IMWALLET_DOWNLOAD_ROOT` = `/var/www/download.imwallet.app`
- `EAS_UPDATE_BRANCH` = `production`

## 동작 방식
- `main`(또는 `master`) 푸시 시:
  - `backend/**`, `database/**` 변경 -> Backend CD 자동 실행
  - `imwallet-console/**` 변경 -> Console CD 자동 실행
- `download/**`, `downloads/**` 변경 -> Download Landing CD 자동 실행
  - `imwallet-app/**` 변경 -> OTA 자동 실행
- 네이티브 빌드는 수동 실행:
  - GitHub Actions > `IMWallet App Native Build` > `Run workflow`

## 로컬 빠른 푸시 명령
- 스크립트:
```bash
bash scripts/imwallet-cd/imwallet-publish.sh "feat: message"
```
- 특정 경로만 푸시:
```bash
bash scripts/imwallet-cd/imwallet-publish.sh "fix: backend only" backend .github/workflows
```
- 원격 기본값:
  - `imwallet` remote가 있으면 자동으로 `imwallet`에 push
  - 없으면 `origin`에 push
  - 수동 지정: `IMWALLET_GIT_REMOTE=origin bash scripts/imwallet-cd/imwallet-publish.sh "..."`

## 중요 주의사항
- 현재 저장소의 `origin`이 IMWallet 전용 리포가 아니면(예: 다른 리포),
  자동 반영 대상도 그 리포 기준으로 동작합니다.
- 즉, 실제 운영하려면 IMWallet 코드가 올라가는 리포와 워크플로가 같은 저장소여야 합니다.
- Download Landing CD는 점프서버에 별도 설치 없이, 로컬/러너에서 ProxyCommand로 앱서버에 배포합니다.
