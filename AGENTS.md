# AGENTS.md

KR | [中文](#中文) | [English](#english)

## KR

## 1) Mission
이 저장소에서 에이전트의 목표는 HeptaLabs 웹사이트를 **일관된 브랜드 메시지와 실행 가능한 문서 체계**로 유지하는 것입니다.

## 2) Scope
### 포함
- 정적 웹사이트(`index.html`, `styles.css`)의 카피/구조/표현 개선
- 프로젝트 문서(`README.md`, `PROJECT_BRIEF.md`, `CONTENT_PLAN.md`, `CONTRIBUTING.md`, `DEPLOYMENT.md`) 유지
- 문서 링크 무결성, 실행 명령 검증, 배포 절차 명확화

### 제외
- 사용자 승인 없는 파괴적 Git 작업(`reset --hard`, 강제 push)
- 서비스 운영 비밀정보(토큰/비밀번호) 생성 또는 저장
- 근거 없는 KPI/성과 수치 임의 기입

## 3) Non-Negotiable Rules
- `README.md`는 사람 중심 문서로 유지
- `AGENTS.md`는 에이전트 실행 규칙의 단일 기준으로 유지
- `AGENT.md`는 호환 포인터로만 운영
- 변경 시 기존 사용자 의도와 브랜드 톤을 우선 보존
- 불확실한 사실은 "가정"으로 명시

## 4) Editing Principles
- 최소 변경 원칙: 요구사항에 필요한 범위만 수정
- 구조 우선 원칙: 소개 -> 근거 -> 실행 순서로 정리
- 문체 원칙: 간결, 명확, 과장 금지
- 파일 참조 원칙: 문서 간 링크를 항상 최신 상태로 유지

## 5) Test / Verification Order
1. 변경 파일 맞춤법/헤더 구조 점검
2. 문서 링크/앵커 유효성 점검
3. 실행 커맨드 재현 가능성 점검(`python3 -m http.server 8000`)
4. 배포 절차 일관성 점검(README vs DEPLOYMENT)
5. 커밋 전 `git diff`로 의도치 않은 변경 확인

## 6) Commit / PR Guidelines
### 브랜치
- `docs/<topic>`: 문서 구조/내용 개선
- `content/<topic>`: 사이트 카피/메시지 개선
- `fix/<topic>`: 오류 수정

### 커밋 메시지
- `docs: ...`, `content: ...`, `fix: ...` 형식 사용

### PR 체크리스트
- 변경 목적 요약 1~2문장
- 영향 범위(문서/카피/배포) 명시
- 스크린샷 첨부(시각 변경 시)
- 링크/명령 검증 결과 첨부

## 7) Multilingual Update Policy
- `README.md`, `AGENTS.md`: KR/ZH/EN 완전 병기 유지
- 기타 문서: 한국어 본문 + 중국어/영어 요약 유지
- 동일 용어 통일:
  - HeptaLabs (고정 표기)
  - CTA (번역 가능하되 의미 동일 유지)
  - Deployment / 배포 / 部署 의미 일치
- 한 언어만 변경한 경우, 다른 언어 섹션도 동기화 여부 확인

## 8) Completion Handoff Format
작업 완료 시 아래 형식으로 보고:
- 변경 파일
- 핵심 변경 내용
- 검증 결과(링크/명령/일관성)
- 남은 리스크 또는 후속 작업

## 9) Reference Context (Source-based)
본 문서 구조는 아래 자료의 핵심 원칙을 반영합니다.
- [YouTube: AGENTS.md Explained](https://www.youtube.com/watch?v=TC7dK0gwgg0&t=38s)
- [Author article](https://proflead.dev/posts/agents-md-tutorial/)
- [Official AGENTS.md](https://agents.md/)

---

## 中文

## 1) Mission
本仓库中，代理的目标是让 HeptaLabs 网站在品牌表达与执行文档上保持一致、可持续维护。

## 2) Scope
### 包含
- 改进静态站点（`index.html`, `styles.css`）文案与结构
- 维护项目文档（`README.md`, `PROJECT_BRIEF.md`, `CONTENT_PLAN.md`, `CONTRIBUTING.md`, `DEPLOYMENT.md`）
- 检查文档链接、运行命令与部署流程一致性

### 不包含
- 未经用户同意执行破坏性 Git 操作（如 `reset --hard`、强制推送）
- 创建或存储生产密钥/密码
- 编造没有依据的业务指标

## 3) Core Rules
- `README.md` 面向人类协作者
- `AGENTS.md` 是代理执行规范的唯一基准
- `AGENT.md` 仅作为兼容入口
- 变更应优先保持用户意图与品牌语气
- 不确定内容必须标注为假设

## 4) Editing Principles
- 最小改动原则
- 结构优先：背景 -> 依据 -> 执行
- 文风简洁、明确、不过度营销
- 始终维护文档间链接正确性

## 5) Verification Order
1. 拼写与标题层级检查
2. 链接与锚点检查
3. 运行命令可复现性检查（`python3 -m http.server 8000`）
4. 部署步骤一致性检查（README vs DEPLOYMENT）
5. 提交前检查 `git diff`

## 6) Commit / PR
- Branch: `docs/<topic>`, `content/<topic>`, `fix/<topic>`
- Commit 前缀: `docs:`, `content:`, `fix:`
- PR 必须包含：目标说明、影响范围、截图（如有）、验证结果

## 7) Multilingual Policy
- `README.md`, `AGENTS.md`: KR/ZH/EN 完整并行维护
- 其他文档: 韩文正文 + 中文/英文摘要
- 统一术语: HeptaLabs / CTA / Deployment
- 任一语言更新时，检查其它语言是否需同步

## 8) Handoff Format
- 修改文件
- 关键变更
- 验证结果
- 剩余风险/后续建议

## 9) References
- [YouTube: AGENTS.md Explained](https://www.youtube.com/watch?v=TC7dK0gwgg0&t=38s)
- [Author article](https://proflead.dev/posts/agents-md-tutorial/)
- [Official AGENTS.md](https://agents.md/)

---

## English

## 1) Mission
In this repository, the agent's mission is to keep the HeptaLabs website consistent in brand message and execution-ready documentation.

## 2) Scope
### In scope
- Improve static site copy/structure (`index.html`, `styles.css`)
- Maintain project docs (`README.md`, `PROJECT_BRIEF.md`, `CONTENT_PLAN.md`, `CONTRIBUTING.md`, `DEPLOYMENT.md`)
- Validate doc links, runnable commands, and deployment consistency

### Out of scope
- Destructive Git operations without explicit approval (`reset --hard`, force push)
- Creating/storing production secrets
- Inventing unsupported KPI claims

## 3) Core Rules
- Keep `README.md` human-first
- Keep `AGENTS.md` as the single source of truth for agent instructions
- Keep `AGENT.md` as compatibility-only pointer
- Preserve user intent and brand tone
- Mark uncertain facts as assumptions

## 4) Editing Principles
- Minimal-change principle
- Structure-first writing: context -> evidence -> execution
- Clear and concise tone, no hype
- Keep cross-document links current

## 5) Verification Order
1. Spelling and heading hierarchy checks
2. Link and anchor checks
3. Command reproducibility (`python3 -m http.server 8000`)
4. Deployment consistency (README vs DEPLOYMENT)
5. Final `git diff` sanity check

## 6) Commit / PR
- Branches: `docs/<topic>`, `content/<topic>`, `fix/<topic>`
- Commit prefixes: `docs:`, `content:`, `fix:`
- PR must include purpose, impact scope, screenshots (if visual), and validation notes

## 7) Multilingual Policy
- `README.md`, `AGENTS.md`: full KR/ZH/EN parity
- Other docs: Korean full text + Chinese/English summaries
- Keep key terms consistent: HeptaLabs, CTA, Deployment
- If one language changes, check whether others need sync

## 8) Handoff Format
- Files changed
- Key updates
- Validation results
- Remaining risks / next actions

## 9) References
- [YouTube: AGENTS.md Explained](https://www.youtube.com/watch?v=TC7dK0gwgg0&t=38s)
- [Author article](https://proflead.dev/posts/agents-md-tutorial/)
- [Official AGENTS.md](https://agents.md/)
