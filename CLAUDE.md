# GPUx — project handoff (read this first)

If the user types **"continue"** (or similar), resume from **Next steps** below — pick the first unchecked item, do it, tick it here, and move on. Keep this file updated as work lands.

## Context
- **Event:** Monad "Metropolis" hackathon. Submission deadline **14 Oct 2026, 09:29 IST**. Judging 14–27 Oct.
- **Track:** Onchain Finance & Trading ($30k split across 3 winners). Judging weights: Technical 20%, Design 20%, Originality 15%, Founder/Market 25%, Traction 20%.
- **Product:** GPUx, an onchain exchange for GPU compute. Providers mint ERC-20 "GPU-hour" contracts backed by an AUSD SLA bond, those contracts trade on Kuru's order book, and buyers hedge on Perpl perps. Delivery is verified by Chainlink CRE, which releases the bond or slashes it to the buyer.
- **First users (for the pitch):** small GPU clouds pre-selling idle H100 capacity; seed-stage AI startups locking in training costs.
- **User preferences:** wants the full product, not an MVP, and to cover almost every bounty. Never add Claude/Anthropic attribution to commits, PRs or docs.

## Bounties targeted (and where each is implemented)
| Bounty | $ | Where |
|---|---|---|
| Agora Mobile Trading (Mera + AUSD + trades via Perpl) | 10k | `apps/mobile` |
| Kuru New Assets & Markets | 5k | contracts + Kuru market deploy script (TODO) |
| Kuru Consumer Trading | 5k | `apps/mobile/src/lib/kuru.ts`, `market/[id].tsx` |
| Perpl API (bot) | 5k | `services/hedge-bot` (TODO) |
| Perpl Analytics/Risk | 3k | `apps/mobile/src/app/(tabs)/risk.tsx` |
| Mera UX (Mera = entire account layer) | 2.5k | `apps/mobile/src/lib/mera.ts` |
| Mera PRF (non-wallet use) | 2.5k | Vault tab: sealed notes + compute access tokens |
| Aurora Intents any-chain deposit | 5k | TODO |
| Chainlink CRE workflow | 3k | `cre-workflows/` (TODO) |
| Nansen | 5k | hedge-bot signal (TODO) |
| Envio | 1k | `indexer/` (TODO) |
| MetaMask Agent Wallet plugin | 2.5k | `metamask-plugin/` (TODO) |
| Kimi / Qwen / Alchemy credits | credits | `services/ai-agents` (TODO), Alchemy RPC |
| Community Team | 5k | eligibility only |

**Rule:** never add Privy or Dynamic. They conflict with "Mera is the entire account layer", which would cost both Mera bounties and Agora.

## Repo layout
- `contracts/`: Foundry, Solidity 0.8.24, OpenZeppelin 5.0.2. Contracts: `MockAUSD`, `ProviderRegistry`, `SLABondVault`, `ComputeContractFactory` + `ComputeToken`, `DeliveryEscrow` (field `accessCommitment` = sha256 of the access token), `ComputeIndex`. `script/Deploy.s.sol` deploys and wires roles. `test/GPUx.t.sol` has 4 passing tests.
- `apps/mobile/`: Expo SDK 57 + Expo Router (`src/app`), a **standalone npm project** (excluded from the pnpm workspace). Typecheck passes; expo-doctor passes 21/21. Web preview works (`npm run web`, port 8081). See `apps/mobile/README.md`.
  - `src/lib/mera.ts`: passkey → PRF → BIP-44 key → `toViemAccount`; secret vaults for PRF use.
  - `src/lib/kuru.ts`: direct viem calls to the Kuru OrderBook/MarginAccount (the SDK is ethers v5, which can't use a Mera signer). Limit orders draw from the margin account; market orders need an ERC-20 approval.
  - `src/lib/perpl.ts`: Ed25519 API-key enrollment (signed by Mera via EIP-712), signed REST requests, onchain `createAccount` + `allowOrderForwarding`.
  - `src/lib/gpux.ts`: reads and writes our contracts. `src/lib/config.ts` holds addresses, read from `EXPO_PUBLIC_*` env (see `.env.example`).
- `apps/provider-portal/` (Next.js), `services/hedge-bot`, `services/ai-agents`, `indexer/`, `cre-workflows/`, `metamask-plugin/`, `packages/shared`: **scaffolds and stubs only**.

## Verified external facts (don't re-research)
- Monad testnet: chain 10143, RPC `https://testnet-rpc.monad.xyz`, viem `monadTestnet`.
- Mera: `@category-labs/mera@0.2.0` (+ `/viem`, `/react-native-webauthn-client`). Needs PRF-capable passkeys; on web `rpId = location.hostname` (localhost is fine). Native needs a dev build, an HTTPS domain with AASA/assetlinks files, and Node 24+.
- Kuru testnet: Router `0x7EFbE105Ca7415dE98F96622173458ac1c054630`, MarginAccount `0xd029C2D98ff85D8F64799017fE00a59B1159CE02`, USDC `0x3bA3d39AFcf8bb994f7964B3e0171Ea2Ba361570`. AUSD is listed on mainnet only (`0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a`), so testnet uses our MockAUSD. Create markets with `ParamCreator.deployMarket` from `@kuru-labs/kuru-sdk` (ethers 5.7.1); use `calculatePrecisions` first.
- Perpl testnet: API `https://testnet.perpl.xyz/api`, exchange `0x1964c32f0be608e7d29302aff5e61268e72080cc`. Order type `t`: 1 = OpenLong, 2 = OpenShort, 3/4 = Close, 5 = Cancel. Price `p` = 0 means a market order. Leverage `lv` is in hundredths. Key enrollment needs a whitelisted Origin, so it must go through a backend proxy. Docs: github.com/PerplFoundation/api-docs.

## Tooling notes (Windows)
- Foundry is installed natively at `%USERPROFILE%\.foundry\bin\forge.exe` (WSL timed out). On a new machine, install Foundry, then run `forge install foundry-rs/forge-std --no-git` inside `contracts/`.
- Install deps: `cd contracts && npm i`, and `cd apps/mobile && npm i`.

## Repo & accounts
- GitHub: https://github.com/Raunakg2005/gpux (branch `main`; `gh` is logged in as Raunakg2005). Commit messages carry no AI attribution. `.env` files and `contracts/lib` are gitignored; after cloning run `forge install foundry-rs/forge-std --no-git` in `contracts/`.
- Chainlink CRE: the Early Access page 404s. The bounty accepts "build, simulate, or deploy", so target `cre workflow simulate` (needs only a CRE account + `cre login`).
- Still to do by the user: add `metropolis@hackathon.monad.xyz` as a repo collaborator; ask Perpl (hackathon Discord) for Origin whitelisting + the testnet collateral token.

## Live web app
- **https://gpux-web.vercel.app** (Vercel project `gpux-web`, team raunak-kumar-guptas-projects; public). Deploy: `cd apps/mobile && npx expo export -p web`, copy `dist/` to `monard hacks/gpux-web/` (keep its `vercel.json` SPA rewrite), then run `vercel deploy --prod --yes` **in the user's terminal tab** (the sandbox can't read the Vercel credentials).
- Passkeys are bound to the domain, so accounts on the live site are new addresses with 0 MON. **Gas faucet (done):** `apps/web-deploy/api/faucet.js` (Vercel function at `/api/faucet`) sends 0.05 MON to accounts under 0.01 MON. It is funded by a separate hot wallet `0x6Ea3427210223F975CB0999D880dAAe65b6fb223` (key in `gpux/.env` as `FAUCET_PRIVATE_KEY` and in Vercel as a sensitive production env var). The app calls it automatically after sign-up/sign-in (`src/lib/gas.ts`); Portfolio shows MON balance and a "Get gas" button. Redeploy everything: `powershell -ExecutionPolicy Bypass -File .\scripts\deploy-web.ps1` in the user's terminal.
- **Monad charges the full gas LIMIT, not gas used**: a CRE report with a 1M limit costs about 0.1 MON. Keep an eye on the faucet (0.25 MON initially) and deployer (~0.19 MON) balances; ask the hackathon Discord for more test MON.

## Next steps
- [x] Pick the track and problem statement, scaffold the monorepo
- [x] Write the contracts and tests (passing)
- [x] Build the mobile app (Mera, Kuru, Perpl, Risk, Vault)
- [x] Seed script `contracts/script/Seed.s.sol`: provider, 20k bond, 4 series (H100 US-EAST/EU-WEST, A100, B200), 2,000 hours each, index prices
- [x] Kuru script `scripts/deploy-kuru-markets.ts`: lists each ComputeToken/AUSD pair, seeds a 5-level ladder, writes `apps/mobile/.env`. Re-runnable (reuses `deployments/<chain>.kuru.json`)
- [x] Dry run on an anvil fork of Monad testnet: deploy, seed, the 4 Kuru markets and a market buy/sell with the app's scaling all worked. Fork artifacts were deleted afterwards
- [x] **Real testnet deploy done (12 Oct)** via `bash scripts/deploy-testnet.sh`. Deployer/provider/CRE wallet: `0xBAc277e47dd7B95c04BB3517b76c1dd9151A054a` (key in `gpux/.env`, ~1.2 MON left). Full addresses: `contracts/deployments/10143.json` and `10143.kuru.json`; app config is in `apps/mobile/.env`.
  - AUSD (mock) `0xe504b470987fB6271Cdf997bcD1cc63B843e3eD9` · Factory `0xe65147390d3ea7157Ea22c36BF9406626E373BB4` · Escrow `0x98cd804aE58Ea5FC9fA4Fb403f6D0D88acDd0ac8` · Index `0x2e58B0f2336dFe76b8bbAb1BfD927E354CBC997F`
  - Kuru markets: H100 US-EAST `0xF79897971C1C495A1Ca43C15EE81589b9De1102f`, H100 EU-WEST `0xb0Cd07612a2E7db094DCB6f563866B9D4009dF64`, A100 `0x2a7CC86E7817Ce15290B2059F54222404ba15894`, B200 `0x88540C94471C377d1faa80b6D6309ABCcdBE3032`
- [x] End-to-end test by the user (12 Oct) in Edge with a Windows Hello passkey: Mera sign-up, testnet AUSD faucet, Kuru market buy all settled onchain. The user's app account is `0x48fa39Fb9725897272e81a5bAf010920F23690A2` (funded with 0.3 MON from the deployer). The RPC is limited to 15 req/s, so the app batches reads through Multicall3. A new passkey account needs testnet MON for gas before any transaction.
- [ ] Market-maker / hedge bot (`services/hedge-bot`): quote on Kuru around the index; Perpl API bot; Nansen signal
- [x] Chainlink CRE (12 Oct): `contracts/src/GPUxCREReceiver.sol` (ReceiverTemplate; 3 tests) deployed at `0xeF963E63d15C2f27baC25b2F7804440B7fdA4c7D` via `script/DeployCRE.s.sol`. It is the escrow oracle and the index publisher. The `cre-workflows/delivery-verifier` workflow has a log trigger (settles redemptions from HTTP telemetry with consensus) and a cron trigger (publishes Kuru mids to the index). Both were run with `cre workflow simulate --broadcast` and verified onchain; see `cre-workflows/README.md`. Gotchas: writeReport needs `gasLimit` 1,000,000 or the receiver silently runs out of gas; check `receiverContractExecutionStatus`. CRE CLI is at `%LOCALAPPDATA%\Programs\cre\cre.exe` and Bun at `%USERPROFILE%\.bun\bin`.
- [ ] (optional) CRE auto-roll / risk-guard handlers
- [x] Envio HyperIndex indexer (`indexer/`, envio 3.14). It **can't run on Windows**, so build and test in WSL (`~/work/gpux-indexer`, Node 22 + pnpm via nvm; copy the repo `indexer/` over; `ENVIO_API_TOKEN` is in `gpux/.env`). `pnpm test` replays the real testnet history and passes. Hosted on Envio Cloud (Development plan, public); pushes to the **`envio` branch** redeploy it. Endpoint: `https://indexer.dev.hyperindex.xyz/d007e9f/v1/graphql`. The app uses it (`src/lib/indexer.ts`) for Portfolio deliveries (with a chain-scan fallback) and Market "Recent trades". Kuru Trade `price` is 1e18-scaled; `filledSize` uses the market's sizePrecision.
- [ ] Perpl enrollment proxy (tiny server that adds the Origin header)
- [ ] Aurora Intents any-chain deposit screen
- [ ] Kimi copilot + Qwen procurement agent (`services/ai-agents`) and a Copilot tab
- [ ] MetaMask Agent Wallet "compute trading" plugin
- [ ] Provider portal (Next.js) with real contract calls
- [ ] WebCrypto polyfill so the Vault works on native; native dev build
- [ ] Seed test volume (traction), logo, 3-min demo video, 2-min pitch, README pitch section, give metropolis@hackathon.monad.xyz access to the GitHub repo, deploy the web build
