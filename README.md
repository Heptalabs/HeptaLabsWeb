# HeptaLabs Web

KR | [中文](#中文) | [English](#english)

## KR

HeptaLabs Web는 HeptaLabs의 회사 소개용 정적 웹사이트 프로젝트입니다. 현재 코드는 `index.html`과 `styles.css` 중심으로 구성되어 있으며, 빠른 소개/문의 전환을 목표로 합니다.

### 프로젝트 개요
- 목적: HeptaLabs의 가치 제안, 서비스, 프로세스, 문의 채널을 명확하게 전달
- 형태: 정적 멀티페이지 사이트(HTML/CSS + Vanilla JavaScript)
- 현재 상태: KR/EN/ZH 다국어 지원 회사 소개 사이트 + 로컬 CMS 기반 콘텐츠 관리

### 영상 기반 요약 (출처 기반)
이 저장소의 문서 체계는 AGENTS.md 소개 영상/글의 핵심을 반영합니다.
- 핵심 메시지: `README.md`는 사람 중심, `AGENTS.md`는 에이전트 실행 지침 중심으로 분리
- 운영 원칙: 분산된 에이전트 규칙을 단일 `AGENTS.md`로 통합해 유지보수 비용 절감
- 호환 전략: 구도구 호환을 위해 `AGENT.md`는 `AGENTS.md`를 가리키는 호환 문서로 유지

참고:
- [YouTube: AGENTS.md Explained](https://www.youtube.com/watch?v=TC7dK0gwgg0&t=38s)
- [Author article](https://proflead.dev/posts/agents-md-tutorial/)
- [Official AGENTS.md](https://agents.md/)

### 현재 구조
```text
.
├── index.html
├── styles.css
├── README.md
├── AGENTS.md
├── AGENT.md
├── PROJECT_BRIEF.md
├── PRODUCT_PRD_V2.md
├── database/
│   ├── schema_v1.sql
│   ├── functions_v1.sql
│   └── seed_v1.sql
├── backend/
│   ├── README.md
│   ├── package.json
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .dockerignore
│   ├── .env.example
│   ├── openapi/
│   │   └── openapi.v1.yaml
│   ├── postman/
│   │   ├── heptalabs-api.postman_collection.json
│   │   └── heptalabs-local.postman_environment.json
│   ├── scripts/
│   │   ├── bootstrap-and-start.sh
│   │   └── smoke-test.sh
│   └── src/
├── CONTENT_PLAN.md
├── CONTRIBUTING.md
└── DEPLOYMENT.md
```

### 로컬 실행
#### 1) Python 내장 서버
```bash
python3 -m http.server 8000
```
브라우저에서 `http://localhost:8000/main`(홈) 또는 `http://localhost:8000` 접속

#### 2) VS Code Live Server(선택)
`index.html`을 Live Server로 열어 확인

### 배포 (GitHub Pages)
기본 배포 타깃은 GitHub Pages입니다.

1. GitHub 저장소 `Settings -> Pages` 이동
2. Source를 `Deploy from a branch`로 선택
3. Branch를 `main` / Folder를 `/ (root)`로 선택
4. 저장 후 배포 URL과 커스텀 도메인(`heptalabs.co.kr`) 연결 상태 확인

자세한 절차는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

### 작업 흐름 (브랜치/PR)
- 브랜치: `docs/<topic>`, `content/<topic>`, `fix/<topic>`
- 커밋 예시:
  - `docs: update README multilingual sections`
  - `content: revise hero copy and CTA`
- PR 규칙:
  - 변경 목적 1~2문장 요약
  - 스크린샷(디자인/카피 변경 시)
  - 문서 링크/앵커 점검 후 리뷰 요청

상세 규칙은 [CONTRIBUTING.md](./CONTRIBUTING.md)와 [AGENTS.md](./AGENTS.md)를 따릅니다.

### 문서 맵
- [AGENTS.md](./AGENTS.md): 에이전트 전용 작업 지침(단일 기준)
- [AGENT.md](./AGENT.md): 구도구 호환 포인터
- [PROJECT_BRIEF.md](./PROJECT_BRIEF.md): 프로젝트 목적/타깃/성공지표
- [PRODUCT_PRD_V2.md](./PRODUCT_PRD_V2.md): 웹앱(클라이언트/관리자) 개발 요구사항 v2
- [IMWALLET_DEVELOPMENT_PLAN.md](./IMWALLET_DEVELOPMENT_PLAN.md): IMWallet 개발 착수 전 아키텍처/인프라/단계별 계획
- [IMWALLET_GITHUB_SETUP.md](./IMWALLET_GITHUB_SETUP.md): IMWallet Git 브랜치/CI/CD/GitHub 운영 가이드
- [IMWALLET_LOCAL_STAGING_SETUP.md](./IMWALLET_LOCAL_STAGING_SETUP.md): GitHub 없이 맥 단독 스테이징 운영 가이드
- [IMWALLET_APP_MOCK_DEV.md](./IMWALLET_APP_MOCK_DEV.md): 서버/GitHub 없이 IMWallet 앱 목업 개발 및 실행 가이드
- [imwallet-app/README.md](./imwallet-app/README.md): IMWallet 모바일 앱 로컬 실행 가이드
- [database/schema_v1.sql](./database/schema_v1.sql): PostgreSQL 스키마 초안(v1)
- [database/functions_v1.sql](./database/functions_v1.sql): 정산 배치/레벨 계산 SQL 함수(v1)
- [database/seed_v1.sql](./database/seed_v1.sql): 초기 운영 데이터 시드(v1)
- [backend/README.md](./backend/README.md): 백엔드 실행 가이드
- [backend/docker-compose.yml](./backend/docker-compose.yml): 백엔드/DB 로컬 통합 실행(Docker Compose)
- [backend/Dockerfile](./backend/Dockerfile): API 컨테이너 빌드 정의
- [backend/openapi/openapi.v1.yaml](./backend/openapi/openapi.v1.yaml): API 명세(OpenAPI v1)
- [backend/postman/heptalabs-api.postman_collection.json](./backend/postman/heptalabs-api.postman_collection.json): Postman 컬렉션
- [backend/scripts/bootstrap-and-start.sh](./backend/scripts/bootstrap-and-start.sh): DB 부트스트랩 후 API 시작 스크립트
- [backend/scripts/smoke-test.sh](./backend/scripts/smoke-test.sh): API 스모크 테스트 스크립트
- [CONTENT_PLAN.md](./CONTENT_PLAN.md): 섹션별 카피 매트릭스/CTA/톤
- [CONTRIBUTING.md](./CONTRIBUTING.md): 협업/커밋/리뷰 규칙
- [DEPLOYMENT.md](./DEPLOYMENT.md): GitHub Pages 배포/체크리스트/롤백

---

## 中文

HeptaLabs Web 是 HeptaLabs 的公司介绍静态网站项目。当前代码以 `index.html` 与 `styles.css` 为核心，目标是清晰传达品牌价值并提高咨询转化。

### 项目概览
- 目标: 清晰展示 HeptaLabs 的价值、服务、流程与联系方式
- 形式: 静态多页面站点（HTML/CSS + Vanilla JavaScript）
- 当前状态: 支持 KR/EN/ZH 多语言的公司站点 + 本地 CMS 内容管理

### 基于视频的摘要（来源交叉验证）
本仓库的文档体系参考了 AGENTS.md 相关视频与作者文章：
- `README.md` 面向人类协作者
- `AGENTS.md` 面向 AI 编码代理执行指令
- 通过单一 `AGENTS.md` 统一代理规则，降低维护成本
- 为兼容旧工具，保留 `AGENT.md` 作为兼容入口

参考链接:
- [YouTube: AGENTS.md Explained](https://www.youtube.com/watch?v=TC7dK0gwgg0&t=38s)
- [Author article](https://proflead.dev/posts/agents-md-tutorial/)
- [Official AGENTS.md](https://agents.md/)

### 当前结构
```text
.
├── index.html
├── styles.css
├── README.md
├── AGENTS.md
├── AGENT.md
├── PROJECT_BRIEF.md
├── PRODUCT_PRD_V2.md
├── database/
│   ├── schema_v1.sql
│   ├── functions_v1.sql
│   └── seed_v1.sql
├── backend/
│   ├── README.md
│   ├── package.json
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .dockerignore
│   ├── .env.example
│   ├── openapi/
│   │   └── openapi.v1.yaml
│   ├── postman/
│   │   ├── heptalabs-api.postman_collection.json
│   │   └── heptalabs-local.postman_environment.json
│   ├── scripts/
│   │   ├── bootstrap-and-start.sh
│   │   └── smoke-test.sh
│   └── src/
├── CONTENT_PLAN.md
├── CONTRIBUTING.md
└── DEPLOYMENT.md
```

### 本地运行
```bash
python3 -m http.server 8000
```
打开 `http://localhost:8000/main`（首页）或 `http://localhost:8000`

### 部署 (GitHub Pages)
默认部署目标为 GitHub Pages：
1. 进入 `Settings -> Pages`
2. Source 选择 `Deploy from a branch`
3. Branch 选择 `main`，Folder 选择 `/ (root)`
4. 保存后确认发布 URL 与自定义域名（`heptalabs.co.kr`）状态

更多细节见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

### 工作流 (Branch / PR)
- Branch: `docs/<topic>`, `content/<topic>`, `fix/<topic>`
- Commit 示例:
  - `docs: update README multilingual sections`
  - `content: revise hero copy and CTA`
- PR 需包含:
  - 变更目标说明
  - 页面截图（若涉及视觉/文案）
  - 文档链接与锚点检查结果

详细规则见 [CONTRIBUTING.md](./CONTRIBUTING.md) 与 [AGENTS.md](./AGENTS.md)。

### 文档地图
- [AGENTS.md](./AGENTS.md): 代理执行规范（单一标准）
- [AGENT.md](./AGENT.md): 旧工具兼容入口
- [PROJECT_BRIEF.md](./PROJECT_BRIEF.md): 目标/受众/关键指标
- [PRODUCT_PRD_V2.md](./PRODUCT_PRD_V2.md): Web 应用（客户端/管理端）需求文档 v2
- [IMWALLET_DEVELOPMENT_PLAN.md](./IMWALLET_DEVELOPMENT_PLAN.md): IMWallet 开发前架构、基础设施与分阶段计划
- [IMWALLET_GITHUB_SETUP.md](./IMWALLET_GITHUB_SETUP.md): IMWallet 的 Git 分支、CI/CD 与 GitHub 运营指南
- [IMWALLET_LOCAL_STAGING_SETUP.md](./IMWALLET_LOCAL_STAGING_SETUP.md): 不接入 GitHub 的 Mac 单机 Staging 运行指南
- [IMWALLET_APP_MOCK_DEV.md](./IMWALLET_APP_MOCK_DEV.md): 无服务器/GitHub 的 IMWallet App mock 开发与运行指南
- [imwallet-app/README.md](./imwallet-app/README.md): IMWallet 移动端本地运行说明
- [database/schema_v1.sql](./database/schema_v1.sql): PostgreSQL 数据库结构草案(v1)
- [database/functions_v1.sql](./database/functions_v1.sql): 结算批处理与等级计算函数(v1)
- [database/seed_v1.sql](./database/seed_v1.sql): 初始运营数据种子(v1)
- [backend/README.md](./backend/README.md): 后端运行指南
- [backend/docker-compose.yml](./backend/docker-compose.yml): 后端与数据库本地联调配置(Docker Compose)
- [backend/Dockerfile](./backend/Dockerfile): API 容器构建定义
- [backend/openapi/openapi.v1.yaml](./backend/openapi/openapi.v1.yaml): API 规范(OpenAPI v1)
- [backend/postman/heptalabs-api.postman_collection.json](./backend/postman/heptalabs-api.postman_collection.json): Postman 集合
- [backend/scripts/bootstrap-and-start.sh](./backend/scripts/bootstrap-and-start.sh): DB 初始化后启动 API 的脚本
- [backend/scripts/smoke-test.sh](./backend/scripts/smoke-test.sh): API 冒烟测试脚本
- [CONTENT_PLAN.md](./CONTENT_PLAN.md): 分区文案矩阵与 CTA
- [CONTRIBUTING.md](./CONTRIBUTING.md): 协作规范
- [DEPLOYMENT.md](./DEPLOYMENT.md): 部署与回滚

---

## English

HeptaLabs Web is a static company website project for HeptaLabs. The current codebase is centered on `index.html` and `styles.css`, with a focus on clear positioning and inquiry conversion.

### Project Overview
- Goal: clearly communicate HeptaLabs value, services, process, and contact channels
- Format: static multi-page site (HTML/CSS + Vanilla JavaScript)
- Current state: KR/EN/ZH multilingual company site with local CMS-based content management

### Source-based Video Summary
This documentation system reflects the core AGENTS.md guidance from the referenced video and article:
- `README.md` stays human-oriented
- `AGENTS.md` is the execution guide for coding agents
- Agent instructions are consolidated into one `AGENTS.md` to reduce maintenance overhead
- `AGENT.md` is kept as a compatibility bridge for older tooling

References:
- [YouTube: AGENTS.md Explained](https://www.youtube.com/watch?v=TC7dK0gwgg0&t=38s)
- [Author article](https://proflead.dev/posts/agents-md-tutorial/)
- [Official AGENTS.md](https://agents.md/)

### Current Structure
```text
.
├── index.html
├── styles.css
├── README.md
├── AGENTS.md
├── AGENT.md
├── PROJECT_BRIEF.md
├── PRODUCT_PRD_V2.md
├── database/
│   ├── schema_v1.sql
│   ├── functions_v1.sql
│   └── seed_v1.sql
├── backend/
│   ├── README.md
│   ├── package.json
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .dockerignore
│   ├── .env.example
│   ├── openapi/
│   │   └── openapi.v1.yaml
│   ├── postman/
│   │   ├── heptalabs-api.postman_collection.json
│   │   └── heptalabs-local.postman_environment.json
│   ├── scripts/
│   │   ├── bootstrap-and-start.sh
│   │   └── smoke-test.sh
│   └── src/
├── CONTENT_PLAN.md
├── CONTRIBUTING.md
└── DEPLOYMENT.md
```

### Local Run
```bash
python3 -m http.server 8000
```
Open `http://localhost:8000/main` (home) or `http://localhost:8000`.

### Deployment (GitHub Pages)
Default deployment target is GitHub Pages:
1. Go to `Settings -> Pages`
2. Set Source to `Deploy from a branch`
3. Select `main` and `/ (root)`
4. Save and verify both the published URL and custom domain (`heptalabs.co.kr`)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full instructions.

### Workflow (Branch / PR)
- Branch naming: `docs/<topic>`, `content/<topic>`, `fix/<topic>`
- Commit examples:
  - `docs: update README multilingual sections`
  - `content: revise hero copy and CTA`
- PR checklist:
  - concise purpose summary
  - screenshots for visual/copy updates
  - verified links/anchors in docs

Detailed collaboration rules: [CONTRIBUTING.md](./CONTRIBUTING.md), [AGENTS.md](./AGENTS.md).

### Documentation Map
- [AGENTS.md](./AGENTS.md): single source of truth for agent instructions
- [AGENT.md](./AGENT.md): backward-compatible pointer
- [PROJECT_BRIEF.md](./PROJECT_BRIEF.md): goals, audience, KPIs
- [PRODUCT_PRD_V2.md](./PRODUCT_PRD_V2.md): implementation-ready web app requirements v2
- [IMWALLET_DEVELOPMENT_PLAN.md](./IMWALLET_DEVELOPMENT_PLAN.md): pre-build architecture, infrastructure, and phased plan for IMWallet
- [IMWALLET_GITHUB_SETUP.md](./IMWALLET_GITHUB_SETUP.md): Git branching, CI/CD, and GitHub operations guide for IMWallet
- [IMWALLET_LOCAL_STAGING_SETUP.md](./IMWALLET_LOCAL_STAGING_SETUP.md): Mac-only local staging guide without GitHub integration
- [IMWALLET_APP_MOCK_DEV.md](./IMWALLET_APP_MOCK_DEV.md): mock-first IMWallet app development and run guide without server/GitHub
- [imwallet-app/README.md](./imwallet-app/README.md): local run guide for the IMWallet mobile app
- [database/schema_v1.sql](./database/schema_v1.sql): PostgreSQL schema draft (v1)
- [database/functions_v1.sql](./database/functions_v1.sql): settlement batch and level-calculation SQL functions (v1)
- [database/seed_v1.sql](./database/seed_v1.sql): initial operation seed data (v1)
- [backend/README.md](./backend/README.md): backend run guide
- [backend/docker-compose.yml](./backend/docker-compose.yml): local backend + database orchestration (Docker Compose)
- [backend/Dockerfile](./backend/Dockerfile): API container build definition
- [backend/openapi/openapi.v1.yaml](./backend/openapi/openapi.v1.yaml): API spec (OpenAPI v1)
- [backend/postman/heptalabs-api.postman_collection.json](./backend/postman/heptalabs-api.postman_collection.json): Postman collection
- [backend/scripts/bootstrap-and-start.sh](./backend/scripts/bootstrap-and-start.sh): DB bootstrap then API start script
- [backend/scripts/smoke-test.sh](./backend/scripts/smoke-test.sh): API smoke test script
- [CONTENT_PLAN.md](./CONTENT_PLAN.md): section-level copy matrix and CTA rules
- [CONTRIBUTING.md](./CONTRIBUTING.md): branch/commit/review conventions
- [DEPLOYMENT.md](./DEPLOYMENT.md): GitHub Pages deploy, checks, rollback
