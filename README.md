# GPUx: onchain compute exchange on Monad

Providers tokenize future GPU-hours backed by an SLA bond; traders buy, sell and hedge them on Monad;
delivery is verified by Chainlink CRE and settled automatically (bond released or slashed to the buyer).

**Track:** Onchain Finance & Trading (Metropolis hackathon)

## First users
- **Sellers:** small GPU clouds pre-selling next month's idle H100 capacity.
- **Buyers:** seed-stage AI startups locking in training compute costs.

## Repo layout
| Path | What | Bounties |
|---|---|---|
| `contracts/` | Foundry: factory, compute tokens, SLA bond vault, delivery escrow, index | Core / Kuru New Markets |
| `apps/mobile/` | Expo app: Mera passkeys, AUSD, Kuru spot, Perpl hedge, risk, copilot | Agora, Mera x2, Kuru Consumer, Aurora |
| `apps/provider-portal/` | Next.js portal for providers | Kuru New Markets |
| `services/hedge-bot/` | Perpl hedging + Kuru market making + Nansen signals | Perpl x2, Nansen |
| `services/ai-agents/` | Kimi copilot + Qwen procurement agent | Kimi, Qwen |
| `indexer/` | Envio HyperIndex | Envio |
| `cre-workflows/` | Delivery verification, index publishing, auto-roll, risk guard | Chainlink CRE |
| `metamask-plugin/` | Agent Wallet "Compute Trading" plugin | MetaMask |
| `packages/shared/` | Chain config, addresses, types | — |

## Quickstart
```bash
pnpm i
cd contracts && forge install foundry-rs/forge-std --no-git && forge test
cp .env.example .env   # fill keys
pnpm contracts:build && cd contracts && pnpm deploy:testnet
```

## Contract flow
1. Provider `register` → `deposit` AUSD bond → `createSeries` → `mintCapacity` (bond locked).
2. Tokens trade on Kuru (ComputeToken/AUSD).
3. Holder `redeem` → CRE `delivery-verifier` checks uptime → `settle(id, ok)`.
4. OK: bond released to provider. Fail: bond slashed to buyer; provider reliability drops.
