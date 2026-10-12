import { Platform } from "react-native";
import { formatEther, parseEther, type Address } from "viem";
import { publicClient } from "./clients";

/** Same-origin faucet on the deployed site; override for local dev. */
const FAUCET_URL = process.env.EXPO_PUBLIC_FAUCET_URL ?? (Platform.OS === "web" ? "/api/faucet" : "");

export const monBalance = (address: Address) => publicClient.getBalance({ address });

/** Tops up a new account with testnet MON for gas. Returns a short status line. */
export async function requestGas(address: Address): Promise<string> {
  if (!FAUCET_URL) throw new Error("Gas faucet not available here");
  const res = await fetch(FAUCET_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Faucet error ${res.status}`);
  return body.funded ? `+${body.amount} MON for gas` : "You already have gas";
}

/** Fire-and-forget after sign-up/sign-in so the first transaction just works. */
export async function ensureGas(address: Address) {
  try {
    if ((await monBalance(address)) < parseEther("0.01")) await requestGas(address);
  } catch {
    // best effort; Portfolio has a manual "Get gas" button
  }
}

export const fmtMon = (wei: bigint) => Number(formatEther(wei)).toFixed(3);
