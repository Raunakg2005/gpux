import { createPublicClient, createWalletClient, http, type Account, type Hash } from "viem";
import { chain, RPC_URL } from "./config";

// The public RPC allows 15 req/s: batch concurrent reads into one Multicall3 eth_call and
// back off on 429s.
export const publicClient = createPublicClient({
  chain,
  batch: { multicall: { wait: 16 } },
  transport: http(RPC_URL, { retryCount: 5, retryDelay: 400 }),
});

export function walletFor(account: Account) {
  return createWalletClient({ account, chain, transport: http(RPC_URL) });
}

export type Wallet = ReturnType<typeof walletFor>;

/** Send and wait: Monad finalizes in ~800ms, so the UI can await real settlement instead of "pending". */
export async function confirm(hash: Hash) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 250 });
  if (receipt.status !== "success") throw new Error(`Transaction reverted: ${hash}`);
  return receipt;
}
