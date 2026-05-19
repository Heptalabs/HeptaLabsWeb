# Quickstart (UE5 + Browser)

작성일: 2026-05-19 (KST)

## 0) 먼저 확인
- 로컬 Signalling/Web 서버 주소: `http://127.0.0.1:8080`
- UE가 연결할 WebSocket 주소: `ws://127.0.0.1:8888`

## 1) 인프라 서버 실행
프로젝트 루트에서:

```bash
./scripts/start_infra.sh
```

상태 확인:

```bash
./scripts/status_infra.sh
```

중지:

```bash
./scripts/stop_infra.sh
```

## 2) UE5 프로젝트 준비
1. UE5에서 Third Person 프로젝트 생성
2. `Edit > Plugins`에서 `Pixel Streaming` 또는 `Pixel Streaming 2` 활성화
3. 에디터 재시작
4. `Edit > Editor Preferences > Level Editor > Play`에서
   - `Additional Launch Parameters`에 아래 값 입력

```text
-PixelStreamingURL=ws://127.0.0.1:8888 -RenderOffScreen
```

5. Play 모드를 **Standalone Game**으로 실행

## 3) 브라우저 접속
- 브라우저에서 `http://127.0.0.1:8080` 접속
- 페이지 클릭 후 Play 버튼으로 스트림 시작

## 4) 핵심 포인트
- 패키징 전에도 가능: **Standalone Game + Pixel StreamingURL**
- 프로덕션은 패키징 빌드 전환 권장

## 공식 근거
- Getting Started (UE 5.6):
  https://dev.epicgames.com/documentation/en-us/unreal-engine/getting-started-with-pixel-streaming-in-unreal-engine?application_version=5.6
- Pixel Streaming Reference (UE 5.6):
  https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-pixel-streaming-reference?application_version=5.6
