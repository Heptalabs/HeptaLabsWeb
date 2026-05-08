# IMWallet APK 배포 경로

`download/index.html`의 Android APK 버튼은 아래 파일로 연결됩니다.

- `/downloads/imwallet-latest.apk`
- `/downloads/latest.json` (버전 라벨 메타데이터)

앱 패키징 후 최신 APK를 위 경로 파일명으로 업로드하면 버튼 클릭 시 다운로드됩니다.
또한 `latest.json`의 `label` 값이 버튼 하단의 회색 버전 텍스트로 표시됩니다.

배포 스크립트 사용 예시:
```bash
IMWALLET_JUMP_HOST=121.140.83.207 \
IMWALLET_APP_HOST=192.168.1.167 \
SSH_KEY_PATH="$HOME/.ssh/imwallet_jump_20260423" \
bash scripts/imwallet-cd/deploy-apk-via-jump.sh /path/to/app-release.apk
```
