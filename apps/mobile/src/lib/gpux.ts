import { encodeAbiParameters, keccak256, parseUnits, sha256, type Address, type Hex } from "viem";
import { bondVaultAbi, erc20Abi, escrowAbi, factoryAbi, indexAbi, mockAusdAbi, registryAbi } from "./abis";
import { confirm, publicClient, type Wallet } from "./clients";
import { gpux } from "./config";

export const AUSD_DECIMALS = 6;
export const GPU_HOUR_DECIMALS = 18;

export type Series = {
  id: bigint;
  provider: Address;
  token: Address;
  gpuType: string;
  region: string;
  deliveryStart: number;
  deliveryEnd: number;
  bondPerHour: bigint;
  maxSupply: bigint;
};

export type Provider = { name: string; active: boolean; ok: number; failed: number; reliabilityBps: number };

export const RedemptionStatus = ["None", "Pending", "Delivered", "Failed"] as const;
export type Redemption = {
  id: bigint;
  seriesId: bigint;
  amount: bigint;
  commitment: Hex;
  status: (typeof RedemptionStatus)[number];
};

export const indexKey = (gpuType: string, region: string) =>
  keccak256(encodeAbiParameters([{ type: "string" }, { type: "string" }], [gpuType, region]));

export const seriesLabel = (s: Pick<Series, "gpuType" | "region" | "deliveryStart">) => {
  const d = new Date(s.deliveryStart * 1000);
  return `${s.gpuType} · ${s.region} · wk of ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
};

let seriesCache: { at: number; rows: Promise<Series[]> } | null = null;

/** Series are immutable once created, so the list is cached for 30s across screens. */
export function listSeries(): Promise<Series[]> {
  if (!seriesCache || Date.now() - seriesCache.at > 30_000) {
    const rows = fetchSeries();
    rows.catch(() => (seriesCache = null));
    seriesCache = { at: Date.now(), rows };
  }
  return seriesCache.rows;
}

async function fetchSeries(): Promise<Series[]> {
  const count = await publicClient.readContract({ address: gpux.factory, abi: factoryAbi, functionName: "seriesCount" });
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
  const rows = await Promise.all(
    ids.map((id) => publicClient.readContract({ address: gpux.factory, abi: factoryAbi, functionName: "series", args: [id] })),
  );
  return rows.map((s, i) => ({
    id: ids[i],
    provider: s.provider,
    token: s.token,
    gpuType: s.gpuType,
    region: s.region,
    deliveryStart: Number(s.deliveryStart),
    deliveryEnd: Number(s.deliveryEnd),
    bondPerHour: s.bondPerHour,
    maxSupply: s.maxSupply,
  }));
}

/** AUSD per GPU-hour (6 decimals) from the CRE-published ComputeIndex; 0 if never published. */
export async function indexPrice(gpuType: string, region: string): Promise<{ price: bigint; updatedAt: number }> {
  const [price, ts] = await publicClient.readContract({
    address: gpux.index,
    abi: indexAbi,
    functionName: "latest",
    args: [indexKey(gpuType, region)],
  });
  return { price, updatedAt: Number(ts) };
}

export async function getProvider(address: Address): Promise<Provider> {
  const [p, bps] = await Promise.all([
    publicClient.readContract({ address: gpux.registry, abi: registryAbi, functionName: "providers", args: [address] }),
    publicClient.readContract({ address: gpux.registry, abi: registryAbi, functionName: "reliabilityBps", args: [address] }),
  ]);
  return { name: p[0], active: p[2], ok: Number(p[3]), failed: Number(p[4]), reliabilityBps: Number(bps) };
}

export async function bondStatus(s: Series) {
  const [locked, supply] = await Promise.all([
    publicClient.readContract({ address: gpux.vault, abi: bondVaultAbi, functionName: "lockedBond", args: [s.provider, s.id] }),
    publicClient.readContract({ address: s.token, abi: erc20Abi, functionName: "totalSupply" }),
  ]);
  return { locked, supply };
}

export const tokenBalance = (token: Address, user: Address) =>
  publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [user] });

export const ausdBalance = (user: Address) => tokenBalance(gpux.ausd, user);

export async function faucetAusd(wallet: Wallet, amount = "1000") {
  return confirm(
    await wallet.writeContract({
      address: gpux.ausd,
      abi: mockAusdAbi,
      functionName: "faucet",
      args: [wallet.account.address, parseUnits(amount, AUSD_DECIMALS)],
    }),
  );
}

/**
 * Redeem GPU-hours for delivery. The access token that unlocks the compute is sealed with the
 * buyer's passkey (Mera PRF vault); only its sha256 commitment goes onchain so the provider can verify it.
 */
export async function redeem(wallet: Wallet, seriesId: bigint, hours: string, accessToken: Uint8Array) {
  return confirm(
    await wallet.writeContract({
      address: gpux.escrow,
      abi: escrowAbi,
      functionName: "redeem",
      args: [seriesId, parseUnits(hours, GPU_HOUR_DECIMALS), sha256(accessToken)],
    }),
  );
}

/** Linear scan is fine on testnet; the Envio indexer replaces this for production. */
export async function myRedemptions(user: Address): Promise<Redemption[]> {
  const count = await publicClient.readContract({ address: gpux.escrow, abi: escrowAbi, functionName: "redemptionCount" });
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
  const rows = await Promise.all(
    ids.map((id) => publicClient.readContract({ address: gpux.escrow, abi: escrowAbi, functionName: "redemptions", args: [id] })),
  );
  return rows
    .map((r, i) => ({ id: ids[i], buyer: r[1], seriesId: r[0], amount: r[2], commitment: r[3], status: RedemptionStatus[r[4]] }))
    .filter((r) => r.buyer.toLowerCase() === user.toLowerCase())
    .map(({ buyer: _b, ...r }) => r);
}
