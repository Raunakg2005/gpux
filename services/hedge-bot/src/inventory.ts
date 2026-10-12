import { createPublicClient, encodeAbiParameters, formatUnits, http, keccak256, parseAbi } from "viem";
import { monadTestnet } from "viem/chains";
import { cfg } from "./config.js";

const client = createPublicClient({ chain: monadTestnet, batch: { multicall: true }, transport: http(cfg.rpcUrl, { retryCount: 5 }) });

const factoryAbi = parseAbi([
  "struct Series { address provider; address token; string gpuType; string region; uint64 deliveryStart; uint64 deliveryEnd; uint256 bondPerHour; uint256 maxSupply; }",
  "function seriesCount() view returns (uint256)",
  "function series(uint256) view returns (Series)",
]);
const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const indexAbi = parseAbi(["function latest(bytes32) view returns (uint128 price, uint64 timestamp)"]);

export type Line = { label: string; hours: number; priceUsd: number; valueUsd: number };

/** USD value of the owner's GPU-hour inventory, marked at the CRE-published ComputeIndex. */
export async function computeInventory(owner: `0x${string}`): Promise<{ lines: Line[]; totalUsd: number }> {
  const count = await client.readContract({ address: cfg.factory, abi: factoryAbi, functionName: "seriesCount" });
  const lines = await Promise.all(
    Array.from({ length: Number(count) }, async (_, i) => {
      const s = await client.readContract({ address: cfg.factory, abi: factoryAbi, functionName: "series", args: [BigInt(i)] });
      const key = keccak256(encodeAbiParameters([{ type: "string" }, { type: "string" }], [s.gpuType, s.region]));
      const [bal, [price]] = await Promise.all([
        client.readContract({ address: s.token, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
        client.readContract({ address: cfg.computeIndex, abi: indexAbi, functionName: "latest", args: [key] }),
      ]);
      const hours = Number(formatUnits(bal, 18));
      const priceUsd = Number(formatUnits(price, 6));
      return { label: `${s.gpuType} ${s.region}`, hours, priceUsd, valueUsd: hours * priceUsd };
    }),
  );
  return { lines, totalUsd: lines.reduce((a, l) => a + l.valueUsd, 0) };
}
