import { Platform } from "react-native";
import { monadTestnet } from "viem/chains";
import type { Address } from "viem";

const env = (key: string, fallback = "") => process.env[key] ?? fallback;
const addr = (key: string) => env(key, "0x0000000000000000000000000000000000000000") as Address;

export const chain = monadTestnet;
export const RPC_URL = env("EXPO_PUBLIC_RPC_URL", "https://testnet-rpc.monad.xyz");
export const EXPLORER = "https://testnet.monadexplorer.com";

/** Passkeys are bound to this relying-party id. Web uses the page host; native needs the domain serving the association files. */
export const RP_ID = Platform.OS === "web" && typeof location !== "undefined" ? location.hostname : env("EXPO_PUBLIC_RP_ID");
export const RP_NAME = "GPUx";

/** GPUx contracts: fill from `forge script script/Deploy.s.sol` output. */
export const gpux = {
  ausd: addr("EXPO_PUBLIC_AUSD"),
  registry: addr("EXPO_PUBLIC_PROVIDER_REGISTRY"),
  vault: addr("EXPO_PUBLIC_SLA_BOND_VAULT"),
  factory: addr("EXPO_PUBLIC_COMPUTE_FACTORY"),
  escrow: addr("EXPO_PUBLIC_DELIVERY_ESCROW"),
  index: addr("EXPO_PUBLIC_COMPUTE_INDEX"),
};
/** Testnet MockAUSD exposes a faucet; real AUSD does not. */
export const AUSD_HAS_FAUCET = env("EXPO_PUBLIC_AUSD_FAUCET", "true") === "true";

/** Kuru testnet contracts (docs.kuru.io/contracts/Contract-addresses). */
export const kuru = {
  router: "0x7EFbE105Ca7415dE98F96622173458ac1c054630" as Address,
  marginAccount: "0xd029C2D98ff85D8F64799017fE00a59B1159CE02" as Address,
};

/** ComputeToken address (lowercase) -> Kuru order book address, e.g. {"0xabc…":"0xdef…"}. Written by scripts/deploy-kuru-markets. */
export const KURU_MARKETS: Record<string, Address> = JSON.parse(env("EXPO_PUBLIC_KURU_MARKETS", "{}"));

/** Envio hosted GraphQL endpoint; empty falls back to direct chain reads. */
export const INDEXER_URL = env("EXPO_PUBLIC_INDEXER_URL", "https://indexer.dev.hyperindex.xyz/d007e9f/v1/graphql");

/** Perpl testnet (github.com/PerplFoundation/api-docs). */
export const perpl = {
  api: env("EXPO_PUBLIC_PERPL_API", "https://testnet.perpl.xyz/api"),
  /** Key enrollment needs a whitelisted Origin, so it goes through our backend proxy. */
  enrollApi: env("EXPO_PUBLIC_PERPL_ENROLL_API", "https://testnet.perpl.xyz/api"),
  chainId: 10143,
  exchange: "0x1964c32f0be608e7d29302aff5e61268e72080cc" as Address,
};
