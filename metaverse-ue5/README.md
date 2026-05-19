# UE5 Cyber Metaverse (Pixel Streaming Ready)

웹 MVP를 제거하고 Unreal Engine 5 기반으로 재구성한 프로젝트입니다.

## 현재 상태
- UE5 C++ 프로젝트 생성 완료: `CyberMetaverse`
- 광장/상점/카지노 3개 맵 추가
- 포탈 이동, 상점 구매, 바카라, 연설 시스템 구현
- 사이버펑크 스타일 월드/아바타(네온 구조 + 수트 오버레이) 적용
- Mac 로컬 빌드 성공 확인

## 빠른 실행
### 1) 에디터로 열기
```bash
./scripts/launch_cyber_editor.sh
```

### 2) 게임 모드로 즉시 실행
```bash
./scripts/launch_cyber_game.sh
```

### 3) Pixel Streaming 실행
1. 인프라 시작
```bash
./scripts/start_infra.sh
```
2. UE 스트리밍 실행
```bash
./scripts/launch_cyber_pixelstream.sh
```
3. 브라우저 접속
- `http://127.0.0.1:8080`

## 다른 디바이스로 이전
1. 이 프로젝트가 포함된 브랜치를 clone/pull
2. 인프라 준비
```bash
./scripts/setup_infra.sh
```
3. 스트리밍 시작
```bash
./scripts/start_infra.sh
./scripts/launch_cyber_pixelstream.sh
```

## 맵
- `/Game/Maps/L_CyberPlaza`
- `/Game/Maps/L_CyberShop`
- `/Game/Maps/L_CyberCasino`

## 조작
- `WASD`: 이동
- `마우스`: 시점 회전
- `Space`: 점프
- `E`: 상호작용(포탈/상점/카지노/연설)
- `1/2/3`: 상점 구매, 바카라 베팅, 연설 멘트 선택

## 참고 문서
- 구현 요약: `docs/CYBER_METAVERSE_FEATURES.md`
- 브라우저 미리보기: `docs/PHASE_01_BROWSER_PREVIEW.md`
- 프로덕션 스트리밍: `docs/PHASE_02_PRODUCTION_STREAM.md`
