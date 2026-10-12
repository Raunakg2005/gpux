import { createHash, randomBytes } from "node:crypto";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";
import { cfg } from "./config.js";

ed.hashes.sha512 = sha512;

/** Perpl REST client (github.com/PerplFoundation/api-docs): Ed25519-signed requests. */
export type Market = {
  id: number;
  symbol: string;
  config: { price_decimals: number; size_decimals: number };
  state?: { mrk?: number; bid?: number; ask?: number };
};
export type Position = { mkt: number; pid: number; sd: 1 | 2; s: number; ep: number; c: number; lv: number };

export const OrderType = { OpenLong: 1, OpenShort: 2, CloseLong: 3, CloseShort: 4 } as const;
const IOC = 4;

async function signed<T>(method: "GET" | "POST", target: string, payload?: unknown): Promise<T> {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const nonce = randomBytes(16).toString("base64url");
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const canonical = [cfg.perpl.chainId, method, target, timestamp, nonce, bodyHash].join("\n");
  const sig = ed.sign(Buffer.from(canonical), Buffer.from(cfg.perpl.apiSecret.replace(/^0x/, ""), "hex"));
  const res = await fetch(`${cfg.perpl.api}${target}`, {
    method,
    headers: {
      "X-API-Key": cfg.perpl.apiKey,
      "X-API-Timestamp": timestamp,
      "X-API-Nonce": nonce,
      "X-API-Signature": Buffer.from(sig).toString("base64url"),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body || undefined,
  });
  if (!res.ok) throw new Error(`Perpl ${method} ${target}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function getMarket(symbol: string): Promise<Market> {
  const res = await fetch(`${cfg.perpl.api}/v1/pub/context`);
  if (!res.ok) throw new Error(`Perpl context: ${res.status}`);
  const ctx = (await res.json()) as { markets: Market[] };
  const m = ctx.markets.find((x) => x.symbol === symbol);
  if (!m) throw new Error(`Perpl market ${symbol} not found`);
  return m;
}

export const markPrice = (m: Market) => (m.state?.mrk ?? 0) / 10 ** m.config.price_decimals;

export type Account = { id: number; fw: boolean; fr: boolean; b: string; lb: string };

/** Wallet info: the exchange accounts owned by the API key's wallet (live API uses `as`, not `accounts`). */
export async function getWallet(): Promise<{ as?: Account[] } & Record<string, unknown>> {
  return signed("GET", "/v1/trading/wallet");
}

export async function getPositions(): Promise<Position[]> {
  return (await signed<{ d: Position[] }>("GET", "/v1/trading/positions")).d;
}

let lastRq = 0;
/** IOC market order (p = 0) with slippage cap; size in base units. */
export async function marketOrder(m: Market, type: number, size: number, leverage: number) {
  lastRq = Math.max(lastRq + 1, Date.now());
  const res = await signed<{ status: { code: number; error?: string }; statuses?: { code: number; error?: string }[] }>(
    "POST",
    "/v1/trading/orders",
    {
      d: [
        {
          rq: lastRq,
          mkt: m.id,
          acc: cfg.perpl.accountId,
          t: type,
          p: 0,
          s: Math.round(size * 10 ** m.config.size_decimals),
          fl: IOC,
          ms: 50,
          lv: Math.round(leverage * 100),
          lb: 0,
        },
      ],
    },
  );
  const st = res.statuses?.[0] ?? res.status;
  if (st.code !== 0) throw new Error(`Perpl rejected order: ${st.code} ${st.error ?? ""}`);
}
