import { describe, expect, it } from "vitest";
import { checkBuy, checkSell, fillBuy, fillSell, minOut } from "./guard.js";

// Shape of the seeded H100-US-EAST book on testnet.
const book = {
  bids: [
    { price: 2.079, size: 80 },
    { price: 2.058, size: 80 },
  ],
  asks: [
    { price: 2.121, size: 80 },
    { price: 2.142, size: 80 },
  ],
};

describe("fills", () => {
  it("buy walks the asks", () => {
    const f = fillBuy(book, 21.21);
    expect(f.base).toBeCloseTo(10, 6);
    expect(f.avgPrice).toBeCloseTo(2.121, 6);
    expect(f.filledFully).toBe(true);
  });
  it("buy across two levels averages up", () => {
    const f = fillBuy(book, 2.121 * 80 + 2.142 * 10);
    expect(f.base).toBeCloseTo(90, 6);
    expect(f.levels).toBe(2);
    expect(f.avgPrice).toBeGreaterThan(2.121);
  });
  it("sell walks the bids and detects a thin book", () => {
    expect(fillSell(book, 5).quote).toBeCloseTo(10.395, 6);
    expect(fillSell(book, 500).filledFully).toBe(false);
  });
});

describe("guardrails", () => {
  const ok = { spend: 21.21, maxSpend: 250, indexPrice: 2.1, maxPremiumBps: 300 };
  it("passes a normal buy", () => {
    expect(checkBuy(fillBuy(book, 21.21), ok).ok).toBe(true);
  });
  it("enforces the spend cap", () => {
    const r = checkBuy(fillBuy(book, 21.21), { ...ok, maxSpend: 10 });
    expect(r.ok === false && r.code).toBe("GPUX_SPEND_CAP");
  });
  it("refuses fills far above the CRE index", () => {
    const r = checkBuy(fillBuy(book, 21.21), { ...ok, indexPrice: 1.5 });
    expect(r.ok === false && r.code).toBe("GPUX_PRICE_ABOVE_INDEX");
  });
  it("refuses dumping far below the index", () => {
    const r = checkSell(fillSell(book, 5), { hours: 5, indexPrice: 3, maxPremiumBps: 300 });
    expect(r.ok === false && r.code).toBe("GPUX_PRICE_BELOW_INDEX");
  });
  it("applies slippage", () => {
    expect(minOut(10, 100)).toBeCloseTo(9.9, 9);
  });
});
