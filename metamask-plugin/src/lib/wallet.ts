import { CommandError, type PluginCommandContext } from "@metamask/agent-wallet/plugin";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { CHAIN_ID } from "./config.js";
import { client } from "./chain.js";

type WalletLike = { address: string; name?: string; id?: string; walletId?: string | null };
type WalletState = { byokWallets?: WalletLike[]; remoteWallets?: WalletLike[]; selectedWallet?: { ref: { address?: string; id?: string; name?: string } } | null };

/** The wallet mm signs with: the selected one if recorded, else the first known wallet. */
export function activeWallet(ctx: PluginCommandContext): Address {
  const state = (ctx.walletStateManager as unknown as { read(): WalletState }).read();
  const wallets = [...(state.byokWallets ?? []), ...(state.remoteWallets ?? [])];
  const ref = state.selectedWallet?.ref;
  const picked =
    (ref &&
      wallets.find(
        (w) =>
          (ref.address && w.address.toLowerCase() === ref.address.toLowerCase()) ||
          (ref.id && (w.id === ref.id || w.walletId === ref.id)) ||
          (ref.name && w.name === ref.name),
      )) ||
    wallets[0];
  if (!picked || !isAddress(picked.address)) {
    throw new CommandError("WALLET_NOT_FOUND", "No active MetaMask wallet found.", "Run `mm init` / `mm wallet create` first.");
  }
  return getAddress(picked.address);
}

export type Step = { step: string; to: Address; data: Hex; summary: string; hash?: string; status?: string; pollingId?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Executor = (req: any) => Promise<any>;

/**
 * Simulates each step from the agent wallet, then submits it through MetaMask's executor
 * (policy, simulation, Blockaid threat scan, 2FA). Stops at the first step that isn't sent.
 */
export async function runSteps(executor: Executor, from: Address, steps: Step[], onProgress: (msg?: string) => void): Promise<Step[]> {
  let previous: string | undefined;
  for (const s of steps) {
    onProgress(s.summary);
    if (previous) await client.waitForTransactionReceipt({ hash: previous as Hex, timeout: 60_000 }).catch(() => undefined);
    try {
      await client.call({ account: from, to: s.to, data: s.data });
    } catch (e) {
      throw new CommandError(
        "TX_WOULD_REVERT",
        `${s.summary}: would fail on chain (${(e as Error).message.split("\n")[0]}). Nothing was signed or sent.`,
        "Check balances (mm gpux portfolio) and inputs, then retry.",
      );
    }
    const out = await executor({
      kind: "transaction",
      chainId: CHAIN_ID,
      transaction: { to: s.to, data: s.data, value: 0n },
      intent: { action: "custom", summary: s.summary, details: { step: s.step, plugin: "gpux" } },
    });
    onProgress(undefined);
    s.status = out.status;
    s.hash = out.kind === "transaction" ? out.hash || undefined : undefined;
    s.pollingId = out.pendingJob?.pollingId;
    previous = s.hash;
    if (!(s.hash || s.status === "CONFIRMED" || s.status === "BROADCASTED")) break;
  }
  return steps;
}

export function stepsHint(steps: Step[], done: string): string {
  const pending = steps.find((s) => !s.hash && s.pollingId);
  if (pending) return `Step '${pending.step}' awaits your MetaMask approval (2FA). Track: mm wallet requests watch ${pending.pollingId}`;
  const failed = steps.find((s) => !s.hash);
  if (failed && failed.status) return `Step '${failed.step}' did not complete (${failed.status}).`;
  return done;
}
