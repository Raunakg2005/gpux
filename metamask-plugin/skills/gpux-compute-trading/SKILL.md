---
name: gpux-compute-trading
description: Buy, sell, quote and redeem GPU compute (bonded H100/A100/B200 GPU-hour contracts) on Monad with the MetaMask Agent Wallet via `mm gpux`. Use when the user wants GPU capacity, compute pricing, or to hedge/procure training compute.
---

# Trading GPU compute with `mm gpux`

GPUx turns future GPU capacity into ERC-20 "GPU-hour" contracts (1 token = 1 GPU-hour) backed by the
provider's AUSD bond. They trade on Kuru order books on Monad Testnet. A Chainlink CRE workflow publishes
a reference index price and settles deliveries (bond slashed to the buyer if delivery fails).

## Workflow
1. Discover: `mm gpux markets --json` (ids like `H100-US-EAST`, best bid/ask, `indexPrice`).
2. Always quote first: `mm gpux quote --market <ID> --side buy --amount <AUSD> --json`. Report `gpuHours`, `avgPrice` and `premiumBps` to the user.
3. Need AUSD on testnet? `mm gpux faucet --amount 500`.
4. Execute: `mm gpux buy --market <ID> --spend <AUSD>` or `mm gpux sell --market <ID> --hours <N>`.
   Use `--dry-run --json` to check guardrails without sending.
5. Take delivery: `mm gpux redeem --market <ID> --hours <N>` (the access token is saved locally; only its hash goes onchain).
6. Check: `mm gpux portfolio --json` (positions marked at the index; deliveries Pending/Delivered/Failed).

## Guardrails (do not bypass without explicit user approval)
- Spend cap: `--max-spend` (default 250 AUSD per order).
- Price sanity: refuses buys more than `--max-premium-bps` (default 300) above the CRE index, and sells that far below it.
- Every transaction is simulated first, then signed by MetaMask (policy, Blockaid scan, 2FA). If a command returns a `pollingId`, the user must approve it: `mm wallet requests watch <pollingId>`.

## Procurement recipe
"Get me N H100 hours under $P/hr": quote with `--amount N*P`. If `avgPrice <= P` and `filledFully`, buy with
`--spend N*P --max-premium-bps` set so the index check reflects P. Otherwise report the best achievable price.
