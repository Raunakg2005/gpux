# GPUx: the onchain spot market for GPU compute

**Live app:** https://gpux-web.vercel.app · **Track:** Onchain Finance & Trading · **Chain:** Monad Testnet

GPU compute is one of the most important commodities in the world, yet it still trades through opaque bilateral
deals: no spot price, no way to hedge, no guarantee you actually get the hours you paid for. GPUx turns future
GPU capacity into a standardized, bonded, tradable asset, and settles delivery onchain.

## How it works
1. **A provider lists capacity.** A small GPU cloud mints ERC-20 GPU-hour contracts
   (e.g. `H100 · US-EAST · week of 15 Oct`, 1 token = 1 GPU-hour) and locks an **AUSD performance bond** behind every hour.
2. **Traders buy and sell on a real order book.** Each contract is its own **Kuru** spot market on Monad: live depth,
   sub-second fills, no "pending" states.
3. **A Chainlink CRE workflow is the delivery oracle.** When a buyer redeems hours, CRE nodes fetch provider telemetry,
   reach consensus and settle onchain: delivered → bond released; failed → **bond slashed straight to the buyer**.
   A second CRE job publishes the **GPU compute price index** from the Kuru books.
4. **Risk is hedgeable.** A bot sizes a perp hedge on **Perpl** from the provider's inventory and tilts it with
   **Nansen** smart-money positioning.

Everything a user touches is one **passkey** (Mera): no seed phrase, no extension, no custody backend.

## Why this needs Monad
A compute order book only works if quoting is cheap and fills are instant. Monad's 400 ms blocks and ~800 ms finality
let a fully onchain CLOB (Kuru) quote GPU-hours tightly, let CRE settle deliveries in the same session the buyer redeems,
and let the UI show real fills instead of pending spinners.

## First users
- **Sellers:** neoclouds with 8–64 idle H100s that want to pre-sell next month's capacity and get paid up front.
- **Buyers:** seed-stage AI startups that need predictable training compute and refunds when a provider flakes.
- **Hedgers / lenders:** whoever finances GPU fleets today can mark them to an onchain index and hedge.

## What's live (Monad Testnet, verifiable)
| Piece | Status |
|---|---|
| Contracts: factory, ComputeToken, SLA bond vault, delivery escrow, index, CRE receiver | Deployed + 7 Foundry tests |
| 4 Kuru markets (H100 US-East, H100 EU-West, A100, B200) with seeded depth | Live |
| Mobile-first app: passkey onboarding, gas faucet, trade, redeem, risk, sealed vault, copilot | Live on Vercel |
| Chainlink CRE: delivery verifier + index publisher | Broadcast runs settled a real redemption ([tx](https://testnet.monadvision.com/tx/0x9ab84619d943277df468b6b6e15c495d3f6b16bfcbfb784c68f538e52d3990cf)) |
| Envio HyperIndex | Hosted: `https://indexer.dev.hyperindex.xyz/d007e9f/v1/graphql` |
| Perpl + Nansen hedge bot | Live: opened SHORT 0.145 ETH on Perpl (account 1161) |
| MetaMask Agent Wallet plugin (`mm gpux …`) | Verified in `mm` 7.1.0 |

## Sponsor integrations
| Sponsor | Where |
|---|---|
| **Agora** (mobile trading app, Mera, AUSD, Perpl) | `apps/mobile` |
| **Mera** UX (entire account layer) + **PRF** (passkey-sealed notes and compute access keys) | `apps/mobile/src/lib/mera.ts`, Vault tab |
| **Kuru** consumer trading + **new asset class** (GPU-hours) | `scripts/deploy-kuru-markets.ts`, `apps/mobile/src/lib/kuru.ts` |
| **Chainlink CRE** | `cre-workflows/`, `contracts/src/GPUxCREReceiver.sol` |
| **Perpl** API bot + risk/analytics | `services/hedge-bot`, Risk + Hedge tabs |
| **Nansen** | `services/hedge-bot/src/nansen.ts` |
| **Envio** | `indexer/` |
| **MetaMask** Agent Wallet plugin | `metamask-plugin/` |
| **Kimi** copilot | `apps/web-deploy/api/copilot.js`, Copilot tab |

## Try it (2 minutes)
1. Open https://gpux-web.vercel.app on your phone or Chrome/Edge, create a passkey account. You get testnet MON for gas automatically.
2. Portfolio → **Testnet AUSD**.
3. Markets → **H100 US-EAST** → Buy 10 AUSD at market. Watch it settle and appear in *Recent trades · indexed by Envio*.
4. Redeem 1 GPU-hour → it's sealed to your passkey in **Vault**; delivery is settled by the CRE workflow.

## Next steps
- 3 provider LOIs from neoclouds; target **$250k notional** of GPU-hour contracts in the first quarter after mainnet.
- Mainnet with real AUSD, the real Chainlink forwarder, and a provider telemetry adapter (DCGM/k8s uptime exports).
- Weekly roll and a perpetual compute index future once spot volume exists.

## Repo
`contracts/` Foundry · `apps/mobile/` Expo app · `apps/web-deploy/` Vercel functions (gas faucet, copilot) ·
`cre-workflows/` Chainlink CRE · `indexer/` Envio · `services/hedge-bot/` Perpl + Nansen · `metamask-plugin/` mm plugin ·
`scripts/` deploy, seed, Kuru listing, web deploy.
