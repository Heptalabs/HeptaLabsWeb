# DEPLOYMENT

## 배포 대상 (KR)
기본 배포 대상은 **GitHub Pages**이며, 현재 저장소 구조(정적 HTML/CSS)에 최적화되어 있다.

## 사전 조건
- 기본 브랜치: `main`
- 루트에 `index.html` 존재
- 원격 저장소 연결 완료

## GitHub Pages 배포 절차
1. GitHub 저장소 접속
2. `Settings -> Pages` 이동
3. `Source`를 `Deploy from a branch`로 선택
4. Branch를 `main`, Folder를 `/ (root)`로 지정
5. 저장 후 표시되는 배포 URL 확인

## 배포 전 체크리스트
- `index.html` 로컬 렌더링 확인
- `styles.css` 로드 확인
- 연락처/메일/전화 링크 동작 확인
- 문서 링크(README/AGENTS/DEPLOYMENT) 유효성 확인

## 롤백 기본 절차
1. 문제 발생 커밋 식별
2. 이전 정상 커밋으로 되돌리는 수정 커밋 생성
3. `main`에 반영 후 Pages 재배포 완료 확인

참고: 협업 환경에서는 강제 push 대신 되돌림 커밋 방식을 우선 사용한다.

## 로컬 검증 커맨드
```bash
python3 -m http.server 8000
```
브라우저: `http://localhost:8000`

---

## 中文摘要
- 默认部署平台为 GitHub Pages，适配当前静态站点结构。
- 建议使用 `main` + `/ (root)` 部署方式，并在发布前完成链接与渲染检查。
- 回滚优先采用“修复提交”而非强制推送。

## English Summary
- Default target is GitHub Pages, aligned with the current static site layout.
- Use `main` + `/ (root)` and complete pre-release checks for rendering and links.
- Prefer rollback-by-commit over force-push in collaborative workflows.
