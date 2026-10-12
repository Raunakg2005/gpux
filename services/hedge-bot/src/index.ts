/**
 * GPUx hedge bot (Perpl API + Nansen).
 *
 * Every interval:
 *  1. Value the provider's GPU-hour inventory at the CRE-published ComputeIndex.
 *  2. Read Nansen smart-money perp positioning for the hedge asset (cached hourly).
 *  3. Size a short perp hedge on Perpl = inventory x hedgeRatio, tilted by the bias, capped.
 *  4. Rebalance with an IOC market order only when outside the band; cut risk near liquidation.
 * Without Perpl credentials it runs in DRY RUN and logs the orders it would send.
 */
import { cfg, live } from "./config.js";
import { computeInventory } from "./inventory.js";
import { smartMoneyBias } from "./nansen.js";
import { getMarket, getPositions, marketOrder, markPrice, OrderType, type Position } from "./perpl.js";
import { decide, nearLiquidation, shortLiqPrice, targetShortUsd } from "./strategy.js";

const s = cfg.strategy;
const ts = () => new Date().toISOString().slice(11, 19);

async function tick() {
  const [inv, nansen, market] = await Promise.all([
    computeInventory(cfg.inventoryOwner),
    smartMoneyBias(s.market),
    getMarket(s.market),
  ]);
  const mark = markPrice(market);
  const positions: Position[] = live() ? await getPositions() : [];
  const short = positions.find((p) => p.mkt === market.id && p.sd === 2);
  const shortSize = short ? short.s / 10 ** market.config.size_decimals : 0;
  const currentUsd = shortSize * mark;

  const target = targetShortUsd(inv.totalUsd, nansen.bias);
  console.log(
    `[${ts()}] inventory $${inv.totalUsd.toFixed(0)} | ${s.market} mark ${mark.toFixed(2)} | smart-money bias ${nansen.bias.toFixed(2)} ` +
      `(${nansen.trades} trades) | short $${currentUsd.toFixed(2)} -> target $${target.toFixed(2)}`,
  );

  if (short) {
    const entry = short.ep / 10 ** market.config.price_decimals;
    const liq = shortLiqPrice(entry, short.lv / 100);
    if (nearLiquidation(mark, liq)) {
      const cut = shortSize / 2;
      console.warn(`  RISK: mark ${mark} within ${s.liqGuard * 100}% of est. liq ${liq.toFixed(2)}; closing ${cut} ${s.market}`);
      if (live()) await marketOrder(market, OrderType.CloseShort, cut, s.leverage);
      return;
    }
  }

  const action = decide(currentUsd, target);
  if (action.kind === "hold") return console.log(`  hold: ${action.reason}`);
  const size = action.usd / mark;
  const type = action.kind === "increaseShort" ? OrderType.OpenShort : OrderType.CloseShort;
  console.log(`  ${live() ? "SEND" : "DRY RUN"}: ${action.kind} $${action.usd.toFixed(2)} = ${size.toFixed(4)} ${s.market} @ ${s.leverage}x`);
  if (live()) await marketOrder(market, type, size, s.leverage);
}

async function main() {
  console.log(`gpux hedge-bot | ${live() ? "LIVE on Perpl testnet" : "DRY RUN (set PERPL_API_KEY/SECRET/ACCOUNT_ID to trade)"} | every ${s.intervalSec}s`);
  const once = process.argv.includes("--once");
  for (;;) {
    try {
      await tick();
    } catch (err) {
      console.error(`[${ts()}] tick failed:`, err instanceof Error ? err.message : err);
    }
    if (once) return;
    await new Promise((r) => setTimeout(r, s.intervalSec * 1000));
  }
}

main();
