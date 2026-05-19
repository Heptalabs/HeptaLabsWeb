# Cyber Metaverse Features

## 구현 완료 범위
- 맵 3개
  - `/Game/Maps/L_CyberPlaza`
  - `/Game/Maps/L_CyberShop`
  - `/Game/Maps/L_CyberCasino`
- 포탈 이동
  - 광장 ↔ 상점 ↔ 카지노
- 상점 시스템
  - 코인 차감 + 인벤토리 추가
- 카지노 시스템
  - 바카라 미니게임(Player/Banker/Tie)
- 광장 연설 시스템
  - 단상 상호작용 + 멘트 송출
- 사이버펑크 비주얼
  - 네온 조명 + 콜로세움형 광장 + 사이버 수트형 아바타 오버레이

## 조작법
- 이동: `WASD`
- 시점: `마우스`
- 점프: `Space`
- 상호작용: `E`
- 선택: `1/2/3`

## 상태 HUD
화면 좌상단 텍스트에 아래 정보가 표시됩니다.
- 코인
- 인벤토리 요약
- 현재 상호작용 안내
- 최근 시스템 메시지

## 코드 진입점
- 게임모드: `Source/TP_ThirdPerson/TP_ThirdPersonGameMode.*`
- 캐릭터: `Source/TP_ThirdPerson/Cyber/CyberAvatarCharacter.*`
- 월드 생성기: `Source/TP_ThirdPerson/Cyber/CyberDistrictBuilder.*`
- 포탈: `Source/TP_ThirdPerson/Cyber/CyberPortalActor.*`
- 상점: `Source/TP_ThirdPerson/Cyber/CyberShopTerminal.*`
- 카지노: `Source/TP_ThirdPerson/Cyber/CyberCasinoTable.*`
- 연설대: `Source/TP_ThirdPerson/Cyber/CyberSpeechPodium.*`
