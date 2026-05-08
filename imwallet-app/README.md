# IMWallet App (Trust-Style Mock)

서버 연동 전 단계에서 Trust Wallet 스타일 UX와 핵심 지갑 플로우를 검증하기 위한 Expo 앱 프로젝트입니다.

## 현재 포함된 기능 (목업)
- 상단 블루 밸런스 카드 + 멀티 지갑 전환
- `Send / Receive / Buy / Swap` 액션 패널
- 토큰/NFT 탭 전환, 검색, 최근 활동
- Discover 탭: 관심 코인, dApp 추천, 학습 카드
- Browser 탭: 카테고리/검색 기반 dApp 브라우저
- Settings 탭: 보안/알림/테스트넷/언어 전환
- 라이트/다크 모드 전환
- 앱 내 다국어 전환: 한국어 / English / 中文

## 빠른 시작
```bash
cd imwallet-app
npm install
npm run check:env
npm run start
```

`npm run start` 후 Expo 터미널에서:
- `i`: iOS Simulator 실행
- `a`: Android Emulator 실행

## 크롬에서 먼저 보기 (권장)
```bash
cd /Users/heptalabs/Documents/New\ project/SJK/imwallet-app
npm install
npm run web
```

- 기본 주소: `http://localhost:8081`
- 현재 단계는 mock-first UI 검증이 목적이며 실제 온체인 브로드캐스트는 동작하지 않는다.

## 맥에서 iOS로 보기
1. Xcode(전체 앱) 설치
2. 초기 1회:
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
```
3. iOS Simulator 실행 후:
```bash
cd imwallet-app
npm run ios
```

## 맥에서 Android로 보기
1. Android Studio 설치 + SDK/AVD 생성
2. 에뮬레이터 실행 후:
```bash
cd imwallet-app
npm run android
```

## 주의
- 현재 코드는 mock 모드이며 실제 체인 RPC/백엔드 미연동 상태다.
- 로고는 `imwallet-app/assets/`의 placeholder 파일을 실제 브랜드 파일로 교체하면 된다.
