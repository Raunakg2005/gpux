import { formatUnits, parseUnits, type Address } from "viem";
import { erc20Abi, kuruMarginAbi, kuruOrderBookAbi } from "./abis";
import { confirm, publicClient, type Wallet } from "./clients";
import { kuru } from "./config";

/**
 * Kuru spot order book, called directly with viem (the official SDK is ethers v5 and
 * cannot use a Mera viem account). Scaling mirrors @kuru-labs/kuru-sdk src/market/*.
 */
export type MarketParams = {
  pricePrecision: bigint;
  sizePrecision: bigint;
  base: Address;
  baseDecimals: number;
  quote: Address;
  quoteDecimals: number;
  tickSize: bigint;
  minSize: bigint;
  maxSize: bigint;
  takerFeeBps: number;
  makerFeeBps: number;
};

export type Level = { price: number; size: number };
export type L2Book = { block: number; bids: Level[]; asks: Level[] };

const digits = (precision: bigint) => precision.toString().length - 1;
const clip = (value: string, decimals: number) => {
  const [i, f = ""] = value.split(".");
  return decimals === 0 || !f ? i : `${i}.${f.slice(0, decimals)}`;
};

const paramsCache = new Map<Address, MarketParams>();

export async function getMarketParams(market: Address): Promise<MarketParams> {
  const cached = paramsCache.get(market);
  if (cached) return cached;
  const r = await publicClient.readContract({ address: market, abi: kuruOrderBookAbi, functionName: "getMarketParams" });
  const p: MarketParams = {
    pricePrecision: BigInt(r[0]),
    sizePrecision: r[1],
    base: r[2],
    baseDecimals: Number(r[3]),
    quote: r[4],
    quoteDecimals: Number(r[5]),
    tickSize: BigInt(r[6]),
    minSize: r[7],
    maxSize: r[8],
    takerFeeBps: Number(r[9]),
    makerFeeBps: Number(r[10]),
  };
  paramsCache.set(market, p);
  return p;
}

/** getL2Book(): 32-byte block number, then (price,size) words for bids until a zero price, then asks. */
export async function getL2Book(market: Address): Promise<L2Book> {
  const p = await getMarketParams(market);
  const data = await publicClient.readContract({ address: market, abi: kuruOrderBookAbi, functionName: "getL2Book" });
  const hex = data.slice(2);
  const word = (i: number) => BigInt("0x" + hex.slice(i * 64, i * 64 + 64));
  const words = Math.floor(hex.length / 64);
  const pd = digits(p.pricePrecision);
  const sd = digits(p.sizePrecision);
  const block = Number(word(0));
  const read = (start: number) => {
    const levels: Level[] = [];
    let i = start;
    while (i + 1 < words) {
      const price = word(i);
      i += 1;
      if (price === 0n) break;
      const size = word(i);
      i += 1;
      levels.push({ price: Number(formatUnits(price, pd)), size: Number(formatUnits(size, sd)) });
    }
    return { levels, next: i };
  };
  const bids = read(1);
  const asks = read(bids.next);
  return { block, bids: bids.levels, asks: asks.levels };
}

async function ensureAllowance(wallet: Wallet, token: Address, spender: Address, amount: bigint) {
  const owner = wallet.account.address;
  const allowance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
  if (allowance >= amount) return;
  await confirm(await wallet.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, amount] }));
}

/** Resting limit orders draw from the Kuru margin account, so fund it first. */
export async function depositToMargin(wallet: Wallet, token: Address, amount: bigint) {
  await ensureAllowance(wallet, token, kuru.marginAccount, amount);
  return confirm(
    await wallet.writeContract({
      address: kuru.marginAccount,
      abi: kuruMarginAbi,
      functionName: "deposit",
      args: [wallet.account.address, token, amount],
    }),
  );
}

export async function marginBalance(user: Address, token: Address) {
  return publicClient.readContract({ address: kuru.marginAccount, abi: kuruMarginAbi, functionName: "getBalance", args: [user, token] });
}

export async function placeLimit(wallet: Wallet, market: Address, o: { price: string; size: string; isBuy: boolean; postOnly: boolean }) {
  const p = await getMarketParams(market);
  const pd = digits(p.pricePrecision);
  const sd = digits(p.sizePrecision);
  const tick = Number(p.tickSize);
  const price = Math.round(Number(parseUnits(clip(o.price, pd), pd)) / tick) * tick; // snap to the tick grid
  const size = parseUnits(clip(o.size, sd), sd);
  if (size < p.minSize) throw new Error("Size below market minimum");
  return confirm(
    await wallet.writeContract({
      address: market,
      abi: kuruOrderBookAbi,
      functionName: o.isBuy ? "addBuyOrder" : "addSellOrder",
      args: [price, size, o.postOnly],
    }),
  );
}

/**
 * Market buy spends `quoteAmount` of quote; market sell sells `baseAmount` of base.
 * `slippageBps` derives minAmountOut from the current book.
 */
export async function placeMarket(wallet: Wallet, market: Address, o: { isBuy: boolean; amount: string; slippageBps: number }) {
  const p = await getMarketParams(market);
  const book = await getL2Book(market);
  const amount = Number(o.amount);
  const expectedOut = o.isBuy ? estimateBuy(book, amount) : estimateSell(book, amount);
  if (expectedOut <= 0) throw new Error("No liquidity on the other side of the book");
  const minOut = (expectedOut * (10_000 - o.slippageBps)) / 10_000;

  if (o.isBuy) {
    await ensureAllowance(wallet, p.quote, market, parseUnits(o.amount, p.quoteDecimals));
    return confirm(
      await wallet.writeContract({
        address: market,
        abi: kuruOrderBookAbi,
        functionName: "placeAndExecuteMarketBuy",
        args: [
          parseUnits(clip(o.amount, digits(p.pricePrecision)), digits(p.pricePrecision)),
          parseUnits(minOut.toFixed(p.baseDecimals), p.baseDecimals),
          false,
          false,
        ],
      }),
    );
  }
  await ensureAllowance(wallet, p.base, market, parseUnits(o.amount, p.baseDecimals));
  return confirm(
    await wallet.writeContract({
      address: market,
      abi: kuruOrderBookAbi,
      functionName: "placeAndExecuteMarketSell",
      args: [
        parseUnits(clip(o.amount, digits(p.sizePrecision)), digits(p.sizePrecision)),
        parseUnits(minOut.toFixed(p.quoteDecimals), p.quoteDecimals),
        false,
        false,
      ],
    }),
  );
}

/** Base received for spending `quote` against the asks. */
export function estimateBuy(book: L2Book, quote: number): number {
  let left = quote;
  let out = 0;
  for (const { price, size } of book.asks) {
    const cost = price * size;
    if (cost >= left) return out + left / price;
    out += size;
    left -= cost;
  }
  return out;
}

/** Quote received for selling `base` into the bids. */
export function estimateSell(book: L2Book, base: number): number {
  let left = base;
  let out = 0;
  for (const { price, size } of book.bids) {
    if (size >= left) return out + left * price;
    out += size * price;
    left -= size;
  }
  return out;
}

export const mid = (book: L2Book) =>
  book.bids[0] && book.asks[0] ? (book.bids[0].price + book.asks[0].price) / 2 : (book.bids[0]?.price ?? book.asks[0]?.price ?? 0);
