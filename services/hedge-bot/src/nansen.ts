import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cfg } from "./config.js";

/**
 * Smart-money positioning from Nansen's perp-trades endpoint, reduced to a bias in [-1, 1].
 * Each call costs credits (5), so results are cached on disk and refreshed at most hourly.
 */
type Trade = { side: "Long" | "Short"; action: string; value_usd: number };
type Cached = { symbol: string; at: number; bias: number; bullUsd: number; bearUsd: number; trades: number };

const CACHE = resolve(import.meta.dirname, "../.nansen-cache.json");

export function biasFromTrades(trades: Trade[]): Omit<Cached, "symbol" | "at"> {
  let bullUsd = 0;
  let bearUsd = 0;
  for (const t of trades) {
    const opening = t.action === "Open" || t.action === "Add";
    // Opening/adding longs or closing/reducing shorts is bullish; the mirror is bearish.
    const bullish = (t.side === "Long") === opening;
    if (bullish) bullUsd += t.value_usd;
    else bearUsd += t.value_usd;
  }
  const total = bullUsd + bearUsd;
  return { bias: total === 0 ? 0 : (bullUsd - bearUsd) / total, bullUsd, bearUsd, trades: trades.length };
}

export async function smartMoneyBias(symbol: string): Promise<Cached> {
  const cached: Cached | null = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : null;
  const fresh = cached && cached.symbol === symbol && Date.now() - cached.at < cfg.strategy.nansenRefreshMin * 60_000;
  if (fresh || !cfg.nansenKey) return cached ?? { symbol, at: 0, bias: 0, bullUsd: 0, bearUsd: 0, trades: 0 };

  const res = await fetch("https://api.nansen.ai/api/v1/smart-money/perp-trades", {
    method: "POST",
    headers: { apikey: cfg.nansenKey, "content-type": "application/json" },
    body: JSON.stringify({
      lookback_hours: 24,
      pagination: { page: 1, per_page: 100 },
      order_by: [{ field: "value_usd", direction: "DESC" }],
      filters: { token_symbol: symbol },
    }),
  });
  if (!res.ok) {
    // Out of credits or rate-limited: keep trading on the last known bias.
    console.warn(`nansen ${res.status}; using cached bias`);
    return cached ?? { symbol, at: 0, bias: 0, bullUsd: 0, bearUsd: 0, trades: 0 };
  }
  const body = (await res.json()) as { data: Trade[] };
  const result: Cached = { symbol, at: Date.now(), ...biasFromTrades(body.data) };
  writeFileSync(CACHE, JSON.stringify(result, null, 2));
  return result;
}
