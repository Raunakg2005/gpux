import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { LocalAccount } from "viem";
import { walletFor, type Wallet } from "@/lib/clients";
import * as mera from "@/lib/mera";

type AccountState = {
  account: LocalAccount | null;
  wallet: Wallet | null;
  create: (name: string) => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => void;
};

const Ctx = createContext<AccountState | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<LocalAccount | null>(null);

  const create = useCallback(async (name: string) => setAccount(await mera.createAccount(name)), []);
  const signIn = useCallback(async () => setAccount(await mera.signIn()), []);
  const signOut = useCallback(() => {
    mera.signOut();
    setAccount(null);
  }, []);

  const value = useMemo(
    () => ({ account, wallet: account ? walletFor(account) : null, create, signIn, signOut }),
    [account, create, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAccount outside AccountProvider");
  return v;
}

/** Signed-in screens only: throws if called before sign-in (the router guards this). */
export function useWallet() {
  const { account, wallet } = useAccount();
  if (!account || !wallet) throw new Error("Not signed in");
  return { account, wallet };
}
