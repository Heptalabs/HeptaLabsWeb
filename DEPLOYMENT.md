# DEPLOYMENT

## 배포 대상 (KR)
기본 배포 대상은 **GitHub Pages**이며, 현재 HeptaLabs 웹사이트는 정적 멀티페이지(HTML/CSS + Vanilla JavaScript) 구조를 사용한다.

## 사전 조건
- 기본 브랜치: `main`
- 루트에 `index.html` 존재
- 라우트 디렉터리 존재: `main/`, `about/`, `business/`, `infos/`, `help/`
- `CNAME` 파일에 `heptalabs.co.kr` 설정
- 원격 저장소 연결 완료

## GitHub Pages 배포 절차
1. GitHub 저장소 접속 (`Heptalabs/HeptaLabsWeb`)
2. `Settings -> Pages` 이동
3. `Source`를 `Deploy from a branch`로 선택
4. Branch를 `main`, Folder를 `/ (root)`로 지정
5. 저장 후 표시되는 배포 URL 확인
6. Custom domain이 `heptalabs.co.kr`로 표시되는지 확인

## 배포 전 체크리스트
- 홈/상세 핵심 경로 렌더링 확인: `/main`, `/about`, `/business`, `/infos`, `/help`
- `styles.css`, `content.js`, `app.js` 로드 확인
- 테마 토글/언어 토글 동작 확인(다국어 KR/EN/ZH)
- 연락처/메일/전화 링크 동작 확인
- 문서 링크(README/AGENTS/DEPLOYMENT) 유효성 확인

## 롤백 기본 절차
1. 문제 발생 커밋 식별
2. `git revert <commit>`로 되돌림 커밋 생성
3. `main` 반영 후 Pages 재배포 완료 확인
4. 주요 경로 재검증 (`/main`, `/about`, `/business`, `/infos`, `/help`)

참고: 협업 환경에서는 강제 push 대신 되돌림 커밋 방식을 우선 사용한다.

## 로컬 검증 커맨드
```bash
python3 -m http.server 8000
```
브라우저: `http://localhost:8000/main` (또는 `http://localhost:8000`)

---

## 中文摘要
- 默认部署平台为 GitHub Pages，当前站点为静态多页面结构。
- 使用 `main` + `/ (root)`，并确认自定义域名 `heptalabs.co.kr` 状态。
- 发布前检查关键路径、主题/语言切换与文档链接。
- 回滚优先使用 `git revert` 生成修复提交，而非强制推送。

## English Summary
- Default target is GitHub Pages, with a static multi-page site layout.
- Use `main` + `/ (root)` and confirm custom domain status (`heptalabs.co.kr`).
- Before release, verify core routes, theme/language toggles, and documentation links.
- Prefer `git revert` rollback commits over force-push in collaborative workflows.
