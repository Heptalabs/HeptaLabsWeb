# IMWallet Smoke Test Report (2026-05-09)

## Automated checks (completed)
1. `npm run preflight:release:security` -> PASS
2. `npm run typecheck` -> PASS
3. `npm run test:run` -> PASS (6/6)
4. `npm run preflight:hardening:phase1` (backend) -> PASS

## Release artifact check (completed)
- AAB path: `android/app/build/outputs/bundle/release/app-release.aab`
- File size: ~56MB
- SHA-256: `f02b806f0865b6ec34c293e61e521f8fb054428c9a9ea88825776b004b8b67bc`
- Release signing fingerprint (upload key, SHA-256):
  - `35:D5:00:F2:1C:84:3E:F4:47:31:A5:8D:E9:85:02:81:39:2A:20:D4:12:F6:2F:FF:EF:87:8E:2B:D5:A5:16:C1`

## Real-device manual smoke (required before production rollout)
- [ ] BTC send/receive (small amount)
- [ ] ETH send/receive (small amount)
- [ ] XRP send/receive (small amount)
- [ ] BSC send/receive (small amount)
- [ ] SOL send/receive (small amount)
- [ ] TRX send/receive (small amount)
- [ ] FIL send/receive (small amount)
- [ ] Seed recovery compatibility check (IMWallet <-> Trust Wallet)
- [ ] App lock check: password mode
- [ ] App lock check: biometric mode (fingerprint/face by device capability)

## Verdict
- Code/security gate and release build gate passed.
- Production rollout requires real-device manual checklist completion.
