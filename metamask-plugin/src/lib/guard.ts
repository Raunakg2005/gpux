/**
 * Pure order math + guardrails (unit-tested). Kuru books are lists of [price, size] levels in
 * human units: price in AUSD per GPU-hour, size in GPU-hours.
 */
export type Level = { price: number; size: number };
export type Book = { bids: Level[]; asks: Level[] };

export type Fill = { base: number; quote: number; avgPrice: number; filledFully: boolean; levels: number };

/** Walk the asks spending `quote` AUSD. */
export function fillBuy(book: Book, quote: number): Fill {
  let left = quote;
  let base = 0;
  let levels = 0;
  for (const { price, size } of book.asks) {
    if (left <= 0) break;
    levels++;
    const cost = price * size;
    if (cost >= left) {
      base += left / price;
      left = 0;
      break;
    }
    base += size;
    left -= cost;
  }
  const spent = quote - left;
  return { base, quote: spent, avgPrice: base > 0 ? spent / base : 0, filledFully: left <= 1e-9, levels };
}

/** Walk the bids selling `base` GPU-hours. */
export function fillSell(book: Book, base: number): Fill {
  let left = base;
  let quote = 0;
  let levels = 0;
  for (const { price, size } of book.bids) {
    if (left <= 0) break;
    levels++;
    const take = Math.min(size, left);
    quote += take * price;
    left -= take;
  }
  const sold = base - left;
  return { base: sold, quote, avgPrice: sold > 0 ? quote / sold : 0, filledFully: left <= 1e-9, levels };
}

export type GuardResult = { ok: true } | { ok: false; code: string; message: string; hint: string };

/** Spend cap + "don't pay far above the Chainlink-CRE index" check for buys. */
export function checkBuy(fill: Fill, opts: { spend: number; maxSpend: number; indexPrice: number; maxPremiumBps: number }): GuardResult {
  if (opts.spend > opts.maxSpend) {
    return { ok: false, code: "GPUX_SPEND_CAP", message: `Spend ${opts.spend} AUSD exceeds the cap of ${opts.maxSpend} AUSD.`, hint: `Lower --spend or raise --max-spend.` };
  }
  if (!fill.filledFully) {
    return { ok: false, code: "GPUX_THIN_BOOK", message: `Only ${fill.quote.toFixed(2)} of ${opts.spend} AUSD can fill against the book.`, hint: "Spend less or wait for more liquidity." };
  }
  if (opts.indexPrice > 0) {
    const premiumBps = ((fill.avgPrice - opts.indexPrice) / opts.indexPrice) * 10_000;
    if (premiumBps > opts.maxPremiumBps) {
      return {
        ok: false,
        code: "GPUX_PRICE_ABOVE_INDEX",
        message: `Average fill ${fill.avgPrice.toFixed(4)} is ${premiumBps.toFixed(0)} bps above the index ${opts.indexPrice.toFixed(4)} (limit ${opts.maxPremiumBps} bps).`,
        hint: "Wait for a better price or raise --max-premium-bps.",
      };
    }
  }
  return { ok: true };
}

/** Sells must fill fully and not dump far below the index. */
export function checkSell(fill: Fill, opts: { hours: number; indexPrice: number; maxPremiumBps: number }): GuardResult {
  if (!fill.filledFully) {
    return { ok: false, code: "GPUX_THIN_BOOK", message: `Only ${fill.base.toFixed(3)} of ${opts.hours} GPU-hours can fill against the bids.`, hint: "Sell less." };
  }
  if (opts.indexPrice > 0) {
    const discountBps = ((opts.indexPrice - fill.avgPrice) / opts.indexPrice) * 10_000;
    if (discountBps > opts.maxPremiumBps) {
      return {
        ok: false,
        code: "GPUX_PRICE_BELOW_INDEX",
        message: `Average fill ${fill.avgPrice.toFixed(4)} is ${discountBps.toFixed(0)} bps below the index ${opts.indexPrice.toFixed(4)}.`,
        hint: "Wait for a better price or raise --max-premium-bps.",
      };
    }
  }
  return { ok: true };
}

/** minAmountOut after slippage. */
export const minOut = (expected: number, slippageBps: number) => (expected * (10_000 - slippageBps)) / 10_000;
