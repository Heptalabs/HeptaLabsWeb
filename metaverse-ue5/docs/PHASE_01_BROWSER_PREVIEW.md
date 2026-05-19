# Phase 01 - 브라우저 미리보기 (패키징 전)

## 목표
- UE5 에디터 상태에서 Pixel Streaming으로 브라우저 접속 확인
- 이동(WASD), 마우스 시점, 기본 상호작용 입력 전달 확인

## 전제
- Unreal Engine 5.4+ 설치
- Pixel Streaming 활성화 가능한 GPU 환경

## 작업 체크리스트
1. UE5 새 프로젝트 생성
2. `Edit > Plugins`에서 Pixel Streaming 관련 플러그인 활성화
3. 기본 맵에 다음 3개 존을 먼저 배치
   - Plaza(연설)
   - Shop(아이템 구매)
   - Arcade(카지노 미니게임)
4. 플레이 입력 바인딩
   - 이동: WASD
   - 시점: Mouse X/Y
   - 점프: Space
5. Editor Pixel Streaming 실행 후 브라우저 접속

## 합격 기준
- 브라우저에서 접속 후 실시간 조작 가능
- 카메라 회전/이동 입력 지연이 치명적이지 않음
- 연결 끊김 없이 5분 이상 유지

## 주의
- 이 단계는 미리보기 단계입니다.
- 실제 배포 품질/성능은 다음 단계(패키징 빌드 스트리밍)에서 확정합니다.
