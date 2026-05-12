# IMWallet Play Data Safety Draft (2026-05-09)

## Scope
- Package: `app.imwallet.mobile`
- Version: `0.1.0` (`versionCode 16`)
- Build artifact: `android/app/build/outputs/bundle/release/app-release.aab`

## Critical declarations (recommended)
- Data collected: **Yes**
- Data shared with third parties: **Yes** (public RPC / explorer / external web content paths)
- Data encrypted in transit: **Yes** (production HTTPS)
- User data deletion request mechanism: **Yes** (`support@imwallet.app`)

## Data categories mapping (draft)
1. Personal info -> User IDs
- Collected: Yes
- Shared: Yes
- Required: Yes
- Examples: wallet address, internal wallet identifier used by app state and network calls
- Purposes: App functionality, Security/fraud prevention

2. Financial info -> Transaction history
- Collected: Yes
- Shared: Yes
- Required: Yes
- Examples: tx hash, sender/recipient address, fee/value metadata used for send/receive and history
- Purposes: App functionality

3. App activity -> In-app interactions
- Collected: Yes
- Shared: No (backend first-party)
- Required: Optional/feature-based
- Examples: Discover click events and content interaction telemetry
- Purposes: Analytics, App functionality

4. Device or other IDs
- Collected: No (as of current code baseline)

5. Location / contacts / photos / files / audio
- Location: No
- Contacts: No
- Audio: No
- Photos/media: Permission exists for image attach flows only (`READ_MEDIA_IMAGES`), no always-on collection path

## Explicit non-collection statement
- Seed phrase and private key are **not uploaded** to IMWallet servers.
- They remain on-device (self-custody model).

## Network paths to disclose
- First-party backend (`EXPO_PUBLIC_BACKEND_BASE_URL`):
  - market, discover content, discover icon cache sync, click logs
- Third-party/public endpoints used by chain operations:
  - BTC: `blockstream.info`, `mempool.space`
  - ETH/BSC: public RPC endpoints
  - XRP: public RPC endpoints
  - SOL: `api.mainnet-beta.solana.com`
  - TRX: `api.trongrid.io`
  - FIL: `api.node.glif.io`

## Console input note
- Final answers must match **actual released build behavior** and SDK behavior.
- Re-check once more after any endpoint/policy change.
