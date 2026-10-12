# GPUx hedge bot (Perpl API + Nansen)

Automated hedging for a GPU provider's compute book on Monad testnet.

Each interval (default 60s):
1. **Inventory:** values the provider's GPU-hour tokens at the Chainlink-CRE-published `ComputeIndex`.
2. **Signal:** Nansen smart-money perp trades for the hedge asset (last 24h) → bias in [-1, 1]
   (opening/adding longs or closing shorts = bullish). Cached on disk and refreshed hourly to save credits.
3. **Target:** short perp hedge = inventory × `HEDGE_RATIO` × (1 − `HEDGE_BIAS_TILT` × bias), capped at `HEDGE_MAX_NOTIONAL_USD`.
   Bearish smart money → hedge more.
4. **Execution:** rebalances on **Perpl** with IOC market orders (50 bps slippage cap) only when drift exceeds
   `HEDGE_REBALANCE_BAND`. If the mark gets within `HEDGE_LIQ_GUARD` of the estimated liquidation price, it halves the short.

Runs in **DRY RUN** (logs intended orders) until Perpl credentials are set.

**Live on Perpl testnet (account 1161):** first tick opened SHORT 0.145 ETH @ 2513.22, 3x, 121.59 AUSD collateral; the next tick held (drift inside band).

## Run
```bash
npm install
npm test          # strategy + Nansen bias unit tests
npm run once      # one tick
npm start         # loop
```

## Env (in `gpux/.env`)
| Var | Purpose |
|---|---|
| `NANSEN_API_KEY` | Nansen API |
| `PERPL_API_KEY`, `PERPL_API_SECRET` (Ed25519 hex), `PERPL_ACCOUNT_ID` | Perpl trading key with `trade` scope; account needs order forwarding enabled |
| `HEDGE_MARKET` (ETH), `HEDGE_RATIO` (0.02), `HEDGE_BIAS_TILT` (0.5), `HEDGE_LEVERAGE` (3), `HEDGE_MAX_NOTIONAL_USD` (500), `HEDGE_REBALANCE_BAND` (0.15), `HEDGE_LIQ_GUARD` (0.1), `HEDGE_INTERVAL_SEC` (60) | Strategy |
| `DRY_RUN=true` | Force dry run even with credentials |

Example dry-run tick (live data):
```
inventory $16558 | ETH mark 2507.57 | smart-money bias -0.20 (50 trades) | short $0.00 -> target $363.91
  DRY RUN: increaseShort $363.91 = 0.1451 ETH @ 3x
```
