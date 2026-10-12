import { CommandError } from "@metamask/agent-wallet/plugin";
import { createPublicClient, encodeAbiParameters, formatUnits, http, keccak256, parseAbi, type Address } from "viem";
import { monadTestnet } from "viem/chains";
import { AUSD_DECIMALS, CONTRACTS, MARKETS, RPC_URL, type ComputeMarket } from "./config.js";
import type { Book } from "./guard.js";

/** Reads go straight to Monad (batched); writes always go through MetaMask's executor. */
export const client = createPublicClient({ chain: monadTestnet, batch: { multicall: true }, transport: http(RPC_URL, { retryCount: 5 }) });

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
export const mockAusdAbi = parseAbi(["function faucet(address to, uint256 amount)"]);
export const orderBookAbi = parseAbi([
  "function getMarketParams() view returns (uint32, uint96, address, uint256, address, uint256, uint32, uint96, uint96, uint256, uint256)",
  "function getL2Book() view returns (bytes)",
  "function placeAndExecuteMarketBuy(uint96 _quoteSize, uint256 _minAmountOut, bool _isMargin, bool _isFillOrKill) payable returns (uint256)",
  "function placeAndExecuteMarketSell(uint96 _size, uint256 _minAmountOut, bool _isMargin, bool _isFillOrKill) payable returns (uint256)",
]);
export const escrowAbi = parseAbi(["function redeem(uint256 seriesId, uint256 amount, bytes accessCommitment) returns (uint256)"]);
const indexAbi = parseAbi(["function latest(bytes32) view returns (uint128 price, uint64 timestamp)"]);

export function findMarket(id: string | undefined): ComputeMarket {
  const m = MARKETS.find((x) => x.id.toLowerCase() === (id ?? "").trim().toLowerCase());
  if (!m) {
    throw new CommandError("GPUX_UNKNOWN_MARKET", `Unknown compute market '${id ?? ""}'.`, `Use one of: ${MARKETS.map((x) => x.id).join(", ")} (see mm gpux markets).`);
  }
  return m;
}

export type Params = { pricePrecision: number; sizePrecision: number; baseDecimals: number; quoteDecimals: number };
const digits = (n: number) => String(n).length - 1;

export async function marketParams(orderBook: Address): Promise<Params> {
  const r = await client.readContract({ address: orderBook, abi: orderBookAbi, functionName: "getMarketParams" });
  return { pricePrecision: Number(r[0]), sizePrecision: Number(r[1]), baseDecimals: Number(r[3]), quoteDecimals: Number(r[5]) };
}

/** Kuru getL2Book(): block word, then (price,size) word pairs for bids until a zero price, then asks. */
export async function l2Book(orderBook: Address, p: Params): Promise<Book> {
  const data = await client.readContract({ address: orderBook, abi: orderBookAbi, functionName: "getL2Book" });
  const hex = data.slice(2);
  const words = Math.floor(hex.length / 64);
  const w = (i: number) => BigInt("0x" + hex.slice(i * 64, i * 64 + 64));
  const read = (start: number) => {
    const levels: { price: number; size: number }[] = [];
    let i = start;
    while (i + 1 < words) {
      const price = w(i++);
      if (price === 0n) break;
      levels.push({ price: Number(formatUnits(price, digits(p.pricePrecision))), size: Number(formatUnits(w(i++), digits(p.sizePrecision))) });
    }
    return { levels, next: i };
  };
  const bids = read(1);
  return { bids: bids.levels, asks: read(bids.next).levels };
}

/** AUSD per GPU-hour published by the Chainlink CRE workflow; 0 if never published. */
export async function indexPrice(m: ComputeMarket): Promise<number> {
  const key = keccak256(encodeAbiParameters([{ type: "string" }, { type: "string" }], [m.gpuType, m.region]));
  const [price] = await client.readContract({ address: CONTRACTS.index, abi: indexAbi, functionName: "latest", args: [key] });
  return Number(formatUnits(price, AUSD_DECIMALS));
}

export const balanceOf = (token: Address, owner: Address) =>
  client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
