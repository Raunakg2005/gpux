import type { Address } from "viem";

/** GPUx on Monad Testnet (contracts/deployments/10143*.json). */
export const CHAIN_ID = 10143;
export const RPC_URL = process.env.GPUX_RPC_URL || "https://testnet-rpc.monad.xyz";
export const INDEXER_URL = process.env.GPUX_INDEXER_URL || "https://indexer.dev.hyperindex.xyz/d007e9f/v1/graphql";

export const CONTRACTS = {
  ausd: "0xe504b470987fB6271Cdf997bcD1cc63B843e3eD9",
  factory: "0xe65147390d3ea7157Ea22c36BF9406626E373BB4",
  escrow: "0x98cd804aE58Ea5FC9fA4Fb403f6D0D88acDd0ac8",
  index: "0x2e58B0f2336dFe76b8bbAb1BfD927E354CBC997F",
} as const satisfies Record<string, Address>;

export type ComputeMarket = {
  id: string; // what the agent passes: H100-US-EAST
  seriesId: bigint;
  gpuType: string;
  region: string;
  token: Address; // ComputeToken (1e18 = 1 GPU-hour)
  orderBook: Address; // Kuru spot market ComputeToken/AUSD
};

export const MARKETS: ComputeMarket[] = [
  { id: "H100-US-EAST", seriesId: 0n, gpuType: "H100", region: "US-EAST", token: "0xe0620631636139Cc54d26d964416E7458A78cdfE", orderBook: "0xF79897971C1C495A1Ca43C15EE81589b9De1102f" },
  { id: "H100-EU-WEST", seriesId: 1n, gpuType: "H100", region: "EU-WEST", token: "0xa25635202dFad8852478Cf020cb8EdAf343D93C1", orderBook: "0xb0Cd07612a2E7db094DCB6f563866B9D4009dF64" },
  { id: "A100-US-EAST", seriesId: 2n, gpuType: "A100", region: "US-EAST", token: "0x889C77B704Ff249Cbd1Fd26eF0cd9955083C1F1E", orderBook: "0x2a7CC86E7817Ce15290B2059F54222404ba15894" },
  { id: "B200-US-WEST", seriesId: 3n, gpuType: "B200", region: "US-WEST", token: "0xd40d29868b253a956C0576D6A0232968F3d3AF1A", orderBook: "0x88540C94471C377d1faa80b6D6309ABCcdBE3032" },
];

export const AUSD_DECIMALS = 6;
export const HOUR_DECIMALS = 18;

/** Guardrail defaults (override per call with flags or via env). */
export const DEFAULT_MAX_SPEND_AUSD = Number(process.env.GPUX_MAX_SPEND_AUSD || 250);
export const DEFAULT_MAX_PREMIUM_BPS = Number(process.env.GPUX_MAX_PREMIUM_BPS || 300);
export const DEFAULT_SLIPPAGE_BPS = 100;
