# HeptaLabs Web

KR | [中文](#中文) | [English](#english)

## KR

HeptaLabs Web는 HeptaLabs의 회사 소개용 정적 웹사이트 프로젝트입니다. 현재 코드는 `index.html`과 `styles.css` 중심으로 구성되어 있으며, 빠른 소개/문의 전환을 목표로 합니다.

### 프로젝트 개요
- 목적: HeptaLabs의 가치 제안, 서비스, 프로세스, 문의 채널을 명확하게 전달
- 형태: 정적 HTML/CSS 랜딩 페이지
- 현재 상태: 단일 페이지 회사 소개 사이트(한국어 카피 중심)

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
├── CONTENT_PLAN.md
├── CONTRIBUTING.md
└── DEPLOYMENT.md
```

### 로컬 실행
#### 1) Python 내장 서버
```bash
python3 -m http.server 8000
```
브라우저에서 `http://localhost:8000` 접속

#### 2) VS Code Live Server(선택)
`index.html`을 Live Server로 열어 확인

### 배포 (GitHub Pages)
기본 배포 타깃은 GitHub Pages입니다.

1. GitHub 저장소 `Settings -> Pages` 이동
2. Source를 `Deploy from a branch`로 선택
3. Branch를 `main` / Folder를 `/ (root)`로 선택
4. 저장 후 배포 URL 확인

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
- [CONTENT_PLAN.md](./CONTENT_PLAN.md): 섹션별 카피 매트릭스/CTA/톤
- [CONTRIBUTING.md](./CONTRIBUTING.md): 협업/커밋/리뷰 규칙
- [DEPLOYMENT.md](./DEPLOYMENT.md): GitHub Pages 배포/체크리스트/롤백

---

## 中文

HeptaLabs Web 是 HeptaLabs 的公司介绍静态网站项目。当前代码以 `index.html` 与 `styles.css` 为核心，目标是清晰传达品牌价值并提高咨询转化。

### 项目概览
- 目标: 清晰展示 HeptaLabs 的价值、服务、流程与联系方式
- 形式: 静态 HTML/CSS 单页站点
- 当前状态: 韩文为主的公司介绍页面

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
├── CONTENT_PLAN.md
├── CONTRIBUTING.md
└── DEPLOYMENT.md
```

### 本地运行
```bash
python3 -m http.server 8000
```
打开 `http://localhost:8000`

### 部署 (GitHub Pages)
默认部署目标为 GitHub Pages：
1. 进入 `Settings -> Pages`
2. Source 选择 `Deploy from a branch`
3. Branch 选择 `main`，Folder 选择 `/ (root)`
4. 保存并确认站点 URL

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
- [CONTENT_PLAN.md](./CONTENT_PLAN.md): 分区文案矩阵与 CTA
- [CONTRIBUTING.md](./CONTRIBUTING.md): 协作规范
- [DEPLOYMENT.md](./DEPLOYMENT.md): 部署与回滚

---

## English

HeptaLabs Web is a static company website project for HeptaLabs. The current codebase is centered on `index.html` and `styles.css`, with a focus on clear positioning and inquiry conversion.

### Project Overview
- Goal: clearly communicate HeptaLabs value, services, process, and contact channels
- Format: static single-page HTML/CSS site
- Current state: Korean-first company profile page

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
├── CONTENT_PLAN.md
├── CONTRIBUTING.md
└── DEPLOYMENT.md
```

### Local Run
```bash
python3 -m http.server 8000
```
Open `http://localhost:8000`.

### Deployment (GitHub Pages)
Default deployment target is GitHub Pages:
1. Go to `Settings -> Pages`
2. Set Source to `Deploy from a branch`
3. Select `main` and `/ (root)`
4. Save and confirm the published URL

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
- [CONTENT_PLAN.md](./CONTENT_PLAN.md): section-level copy matrix and CTA rules
- [CONTRIBUTING.md](./CONTRIBUTING.md): branch/commit/review conventions
- [DEPLOYMENT.md](./DEPLOYMENT.md): GitHub Pages deploy, checks, rollback
