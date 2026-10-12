import { cfg } from "./config.js";

/**
 * Pure hedge logic (unit-tested): how big the short perp hedge should be and what to trade.
 * Smart money net-bearish (bias < 0) -> hedge more; net-bullish -> hedge less.
 */
export function targetShortUsd(inventoryUsd: number, bias: number, s = cfg.strategy): number {
  const tilt = 1 - s.biasTilt * bias; // bias -1 => 1 + tilt, bias +1 => 1 - tilt
  return Math.min(s.maxNotionalUsd, Math.max(0, inventoryUsd * s.hedgeRatio * tilt));
}

export type Action =
  | { kind: "hold"; reason: string }
  | { kind: "increaseShort"; usd: number }
  | { kind: "reduceShort"; usd: number };

export function decide(currentShortUsd: number, targetUsd: number, s = cfg.strategy): Action {
  const diff = targetUsd - currentShortUsd;
  const band = Math.max(s.minOrderUsd, targetUsd * s.rebalanceBand);
  if (Math.abs(diff) < band) return { kind: "hold", reason: `drift $${diff.toFixed(2)} inside band $${band.toFixed(2)}` };
  return diff > 0 ? { kind: "increaseShort", usd: diff } : { kind: "reduceShort", usd: -diff };
}

/** Estimated short liquidation price for isolated margin at `leverage` with ~5% maintenance. */
export function shortLiqPrice(entry: number, leverage: number, maintenance = 0.05) {
  return entry * (1 + 1 / leverage - maintenance);
}

/** True when the mark has moved within `guard` (fraction of mark) of the short's liquidation price. */
export function nearLiquidation(mark: number, liq: number, guard = cfg.strategy.liqGuard) {
  return (liq - mark) / mark < guard;
}
