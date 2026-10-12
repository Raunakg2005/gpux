# GPUx mobile app

Expo SDK 57 + Expo Router (iOS, Android, web). Standalone npm project (excluded from the pnpm workspace so Metro resolves cleanly).

## Run
```bash
npm install
cp .env.example .env      # fill contract addresses after deploying
npm run web               # http://localhost:8081 — passkeys work on localhost
```
Native passkeys need a development build (`npx expo run:ios|android`), not Expo Go, plus an HTTPS domain
(`EXPO_PUBLIC_RP_ID`) serving `apple-app-site-association` / `assetlinks.json`. See docs.monad.xyz/guides/mera/react-native.
Mera's tooling declares Node 24+.

## Screens (`src/app/`)
| Route | What | Integration |
|---|---|---|
| `onboard` | Create / sign in with a passkey | **Mera** is the entire account layer (`src/lib/mera.ts`) |
| `(tabs)/index` Markets | Compute contracts, best bid/ask, index price, provider reliability | GPUx factory/index/registry, Kuru |
| `market/[id]` | Live order book, market/limit orders, redeem for delivery | **Kuru** order book via viem (`src/lib/kuru.ts`) |
| `(tabs)/hedge` | Key enrollment, account setup, long/short perps | **Perpl** REST API (`src/lib/perpl.ts`) |
| `(tabs)/portfolio` | AUSD wallet + Kuru margin balance, holdings, deliveries | AUSD, Kuru MarginAccount, DeliveryEscrow |
| `(tabs)/risk` | Health score, hedge ratio, bond coverage, est. liquidation distance | GPUx + Perpl |
| `(tabs)/vault` | Sealed notes and compute access keys | **Mera PRF** secret vaults (non-wallet use) |

## Notes
- Do not add Privy or Dynamic: Mera must stay the only account layer.
- Perpl key enrollment requires a whitelisted `Origin`; point `EXPO_PUBLIC_PERPL_ENROLL_API` at a backend proxy.
- Mera secret vaults need `crypto.subtle`, which Hermes lacks; the Vault tab works on web today and needs a WebCrypto polyfill on native.
