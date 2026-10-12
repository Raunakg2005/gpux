# mm-plugin-gpux: GPU compute trading for the MetaMask Agent Wallet

Gives the MetaMask Agent Wallet (`mm`) a new trading superpower: **buying and selling GPU compute**.
Agents can quote, buy, sell and redeem bonded GPU-hour contracts (H100/A100/B200) that trade on Kuru's
onchain order books on Monad, priced against a Chainlink-CRE index.

| Command | Capabilities | What it does |
|---|---|---|
| `mm gpux markets` | none | Compute markets with best bid/ask and the CRE index price |
| `mm gpux quote --market --side --amount` | none | Walks the live Kuru book: GPU-hours, avg price, premium vs index |
| `mm gpux buy --market --spend [--max-spend --max-premium-bps --slippage-bps --dry-run]` | wallet-read, wallet-submit | approve + Kuru market buy |
| `mm gpux sell --market --hours [...]` | wallet-read, wallet-submit | approve + Kuru market sell |
| `mm gpux redeem --market --hours` | wallet-read, wallet-submit | Redeem for delivery; sha256 commitment onchain, token kept locally (0600) |
| `mm gpux portfolio` | wallet-read | AUSD, positions at index, deliveries (Envio indexer) |
| `mm gpux faucet --amount` | wallet-read, wallet-submit | Testnet AUSD |

**Guardrails:** per-order spend cap, refuses fills more than N bps away from the Chainlink-CRE index, refuses
partial fills, and simulates every transaction from the agent wallet before signing. All signing goes through
`ctx.walletExecutor`, so MetaMask's policy engine, Blockaid scan and 2FA always apply; the plugin never sees a key.

The agent skill is in `skills/gpux-compute-trading/SKILL.md`.

## Build & install (local)
```bash
npm install
npm test             # guardrail + order-book math (8 tests)
npm run build        # tsc + oclif manifest
mm config set experimentalPlugins true
mm config set experimentalAllowUnverifiedInstalls true
mm plugins install "file:$PWD" --accept-permissions
mm gpux markets
```
Notes: mm links the plugin in place, so it must resolve the **host's** `@metamask/agent-wallet`. On Windows,
mm's internal npm step fails on paths with spaces; install from a path without spaces.
Wallet commands need `mm init`/login and Monad Testnet (10143) in mm's `customEvmChains` with a public RPC
(`https://testnet-rpc.monad.xyz`), since MetaMask's RPC proxy doesn't serve that chain.

## Verified (real `mm` 7.1.0, Monad Testnet)
```
$ mm gpux quote --market H100-US-EAST --side buy --amount 25
25.00 AUSD buys ~11.787 H100-US-EAST GPU-hours at 2.1210 (100 bps vs index).
```
