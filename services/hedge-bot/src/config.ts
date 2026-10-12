import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(import.meta.dirname, "../../../.env") });

const num = (v: string | undefined, d: number) => (v === undefined || v === "" ? d : Number(v));

export const cfg = {
  rpcUrl: process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz",
  /** Wallet whose GPU-hour inventory is hedged (the demo provider by default). */
  inventoryOwner: (process.env.HEDGE_INVENTORY_OWNER ?? "0xBAc277e47dd7B95c04BB3517b76c1dd9151A054a") as `0x${string}`,
  factory: "0xe65147390d3ea7157Ea22c36BF9406626E373BB4" as `0x${string}`,
  computeIndex: "0x2e58B0f2336dFe76b8bbAb1BfD927E354CBC997F" as `0x${string}`,

  perpl: {
    api: process.env.PERPL_API ?? "https://testnet.perpl.xyz/api",
    chainId: 10143,
    apiKey: process.env.PERPL_API_KEY ?? "",
    /** Ed25519 secret (hex) of the API key. */
    apiSecret: process.env.PERPL_API_SECRET ?? "",
    accountId: num(process.env.PERPL_ACCOUNT_ID, 0),
  },
  nansenKey: process.env.NANSEN_API_KEY ?? "",

  strategy: {
    market: process.env.HEDGE_MARKET ?? "ETH",
    /** Fraction of compute inventory value hedged with the perp. */
    hedgeRatio: num(process.env.HEDGE_RATIO, 0.02),
    /** How much the Nansen bias (-1..1) tilts the hedge: bearish smart money -> hedge more. */
    biasTilt: num(process.env.HEDGE_BIAS_TILT, 0.5),
    leverage: num(process.env.HEDGE_LEVERAGE, 3),
    maxNotionalUsd: num(process.env.HEDGE_MAX_NOTIONAL_USD, 500),
    /** Only trade when |target - current| exceeds this fraction of target. */
    rebalanceBand: num(process.env.HEDGE_REBALANCE_BAND, 0.15),
    minOrderUsd: num(process.env.HEDGE_MIN_ORDER_USD, 10),
    /** Cut the position in half if the mark is within this fraction of liquidation. */
    liqGuard: num(process.env.HEDGE_LIQ_GUARD, 0.1),
    intervalSec: num(process.env.HEDGE_INTERVAL_SEC, 60),
    nansenRefreshMin: num(process.env.NANSEN_REFRESH_MIN, 60),
  },
};

/** Trades only with real Perpl credentials and DRY_RUN not forced on. */
export const live = () => !!(cfg.perpl.apiKey && cfg.perpl.apiSecret && cfg.perpl.accountId) && process.env.DRY_RUN !== "true";
