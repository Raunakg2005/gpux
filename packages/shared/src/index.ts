import { defineChain } from "viem";

// Confirm chain id / RPC against https://docs.monad.xyz before deploying.
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" } },
});

/** Filled in from `forge script script/Deploy.s.sol` output. */
export const addresses = {
  ausd: "0x0000000000000000000000000000000000000000",
  providerRegistry: "0x0000000000000000000000000000000000000000",
  slaBondVault: "0x0000000000000000000000000000000000000000",
  computeFactory: "0x0000000000000000000000000000000000000000",
  deliveryEscrow: "0x0000000000000000000000000000000000000000",
  computeIndex: "0x0000000000000000000000000000000000000000",
} as const;

export type ComputeSeries = {
  seriesId: bigint;
  provider: `0x${string}`;
  token: `0x${string}`;
  gpuType: string;
  region: string;
  deliveryStart: number;
  deliveryEnd: number;
  bondPerHour: bigint;
  maxSupply: bigint;
};

export const AUSD_DECIMALS = 6;
export const GPU_HOUR = 10n ** 18n;
