# IMWALLET_LOCAL_STAGING_SETUP

KR | [中文](#中文) | [English](#english)

## KR

## 1) 문서 목적
이 문서는 GitHub 연동 없이, 현재 맥 1대를 IMWallet의 로컬 스테이징 환경으로 사용하는 기준을 정의한다.

## 2) 운영 원칙
- 개발/검증은 이 맥에서 먼저 수행한다.
- 소스 버전관리는 로컬 Git으로만 진행한다. (원격 미연동)
- 정식 서버 이전 직전에 GitHub 연동 및 CI/CD를 붙인다.

## 3) 로컬 스테이징 구성
- 모바일 앱: iOS 시뮬레이터, Android 에뮬레이터
- 백엔드 의존 서비스: PostgreSQL, Redis, MinIO, Mailpit (Docker)
- API 서버: 로컬에서 직접 실행 (`backend` 서비스 코드)

포트 계획:
- API: `http://127.0.0.1:8080`
- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`
- MinIO API: `127.0.0.1:9000`
- MinIO Console: `127.0.0.1:9001`
- Mailpit UI: `127.0.0.1:8025`

## 4) 빠른 시작

### 4.1 사전 점검
```bash
cd templates/imwallet-local
./scripts/preflight-local-staging.sh
```

### 4.2 컨테이너 시작
```bash
cd templates/imwallet-local
./scripts/up-local-staging.sh
```

### 4.3 상태 확인
```bash
cd templates/imwallet-local
./scripts/status-local-staging.sh
```

### 4.4 컨테이너 종료
```bash
cd templates/imwallet-local
./scripts/down-local-staging.sh
```

## 5) 앱 연동 엔드포인트
- iOS Simulator 기본: `http://127.0.0.1:8080`
- Android Emulator 기본: `http://10.0.2.2:8080`

참고:
- Android 에뮬레이터에서 `localhost`는 에뮬레이터 자신을 의미한다.
- 따라서 Mac의 API는 `10.0.2.2`로 접근해야 한다.

## 6) 정식 마이그레이션 전 체크리스트
1. 환경변수 분리: `local-staging`과 `production` 비밀값 완전 분리
2. DB 마이그레이션 파일 정리 및 롤백 스크립트 준비
3. 스토리지 버킷/권한 정책 재검증
4. 앱 빌드 서명키/인증서 운영용 재설정
5. GitHub 저장소(`heptalabs/imwallet`) 생성 후 브랜치 보호 적용
6. CI/CD 연결 후 `staging -> main` 승격 절차 검증

## 7) 가정
- 가정 A: 로컬 스테이징은 단일 운영자 사용을 전제로 한다.
- 가정 B: 이 단계에서는 고가용성(HA)보다 개발 속도를 우선한다.
- 가정 C: 이 문서의 Docker 서비스는 API/앱 검증용 최소 구성이다.

---

## 中文

### 摘要
- 当前阶段可不接入 GitHub，先用这台 Mac 作为本地 Staging。
- 文档提供了最小可运行依赖（PostgreSQL/Redis/MinIO/Mailpit）与一键脚本。
- Android 模拟器请使用 `10.0.2.2:8080`，iOS 模拟器使用 `127.0.0.1:8080`。
- 正式迁移前再接入 `heptalabs/imwallet` 与 CI/CD。

---

## English

### Summary
- You can run a local staging setup on this Mac without GitHub for now.
- This setup includes minimal runtime dependencies (PostgreSQL, Redis, MinIO, Mailpit) with helper scripts.
- Use `10.0.2.2:8080` from Android Emulator and `127.0.0.1:8080` from iOS Simulator.
- Connect GitHub and CI/CD right before production migration.
