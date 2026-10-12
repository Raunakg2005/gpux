/**
 * GPUx hedge + market-making bot. Bounties: Perpl API, Perpl Analytics, Kuru, Nansen.
 *
 * Loop:
 *  1. Read user compute positions (Envio GraphQL) and the ComputeIndex price.
 *  2. Compute net exposure per user that opted into auto-hedge.
 *  3. Adjust Perpl perp hedge to target ratio (perpl.ts).
 *  4. Quote two-sided liquidity on Kuru compute markets around the index (kuru.ts).
 *  5. Pull Nansen smart-money flows as a signal for hedge sizing (nansen.ts).
 *  6. Expose risk metrics over HTTP for the mobile Risk tab.
 */
import { perpl } from "./perpl.js";
import { kuru } from "./kuru.js";
import { nansen } from "./nansen.js";

const INTERVAL_MS = 5_000;

async function tick() {
  const signal = await nansen.smartMoneySignal();
  const exposures = await perpl.loadExposures();
  for (const e of exposures) await perpl.rebalanceHedge(e, signal);
  await kuru.refreshQuotes();
}

async function main() {
  console.log("gpux hedge-bot started");
  for (;;) {
    try {
      await tick();
    } catch (err) {
      console.error("tick failed", err);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main();
