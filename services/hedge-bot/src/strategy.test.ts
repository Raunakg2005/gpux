import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { biasFromTrades } from "./nansen.js";
import { decide, nearLiquidation, shortLiqPrice, targetShortUsd } from "./strategy.js";

const s = { hedgeRatio: 0.02, biasTilt: 0.5, leverage: 3, maxNotionalUsd: 500, rebalanceBand: 0.15, minOrderUsd: 10, liqGuard: 0.1, intervalSec: 60, nansenRefreshMin: 60, market: "ETH" };

test("bearish smart money hedges more, bullish hedges less, capped", () => {
  assert.equal(targetShortUsd(10_000, 0, s), 200);
  assert.equal(targetShortUsd(10_000, -1, s), 300);
  assert.equal(targetShortUsd(10_000, 1, s), 100);
  assert.equal(targetShortUsd(1_000_000, -1, s), 500);
});

test("rebalance only outside the band", () => {
  assert.equal(decide(190, 200, s).kind, "hold");
  assert.deepEqual(decide(0, 200, s), { kind: "increaseShort", usd: 200 });
  assert.deepEqual(decide(300, 200, s), { kind: "reduceShort", usd: 100 });
});

test("liquidation guard", () => {
  const liq = shortLiqPrice(2500, 3); // ~ 2500 * 1.2833
  assert.ok(liq > 3200 && liq < 3210);
  assert.equal(nearLiquidation(2600, liq, 0.1), false);
  assert.equal(nearLiquidation(3000, liq, 0.1), true);
});

test("bias from a real Nansen ETH perp-trades sample", () => {
  const sample = JSON.parse(readFileSync(resolve(import.meta.dirname, "../fixtures/nansen-eth-perp-trades.json"), "utf8"));
  const r = biasFromTrades(sample.data);
  assert.equal(r.trades, 50);
  assert.ok(r.bias < 0 && r.bias > -0.4, `bias ${r.bias}`);
});
