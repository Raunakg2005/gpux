import { Platform } from "react-native";
import * as ed from "@noble/ed25519";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { bytesToHex as nobleHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { bytesToHex, hashTypedData, hexToBytes, parseUnits, type Address, type LocalAccount } from "viem";
import { erc20Abi, perplExchangeAbi } from "./abis";
import { confirm, publicClient, type Wallet } from "./clients";
import { perpl } from "./config";
import { storage } from "./storage";

// noble v3 needs a sync sha512 to sign without WebCrypto (Hermes has none).
ed.hashes.sha512 = sha512;

/**
 * Perpl perps (github.com/PerplFoundation/api-docs). Orders are signed with a per-device
 * Ed25519 API key that the user's Mera wallet enrolls once; the exchange forwards orders onchain.
 */
type ApiKey = { token: string; secretHex: string };
const KEY_STORE = "gpux.perpl.key";

export type PerplMarket = {
  id: number;
  symbol: string;
  name: string;
  config: { price_decimals: number; size_decimals: number };
  state?: { mrk?: number; orl?: number; lst?: number };
};
export type PerplToken = Record<string, unknown> & { address?: Address; symbol?: string; decimals?: number };
export type PerplPosition = { mkt: number; acc: number; pid: number; sd: 1 | 2; s: number; ep: number; c: number; lv: number; st: number };
export type PerplAccount = { id: number; fw: boolean; fr: boolean; b: string; lb: string };

export const OrderType = { OpenLong: 1, OpenShort: 2, CloseLong: 3, CloseShort: 4, Cancel: 5 } as const;
export const OrderFlag = { GTC: 0, PostOnly: 1, FOK: 2, IOC: 4 } as const;

const b64url = (bytes: Uint8Array) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += chars[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += chars[n & 63];
  }
  return out;
};

async function loadKey(): Promise<ApiKey | null> {
  return storage.getJSON<ApiKey>(KEY_STORE);
}

export const hasApiKey = async () => (await loadKey()) !== null;

async function signed<T>(method: "GET" | "POST", target: string, payload?: unknown): Promise<T> {
  const key = await loadKey();
  if (!key) throw new Error("Perpl API key not enrolled");
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const bodyHash = nobleHex(sha256(utf8ToBytes(body)));
  const canonical = [perpl.chainId, method, target, timestamp, nonce, bodyHash].join("\n");
  const sig = ed.sign(utf8ToBytes(canonical), hexToBytes(key.secretHex as `0x${string}`));
  const res = await fetch(perplUrl(target), {
    method,
    headers: {
      "X-API-Key": key.token,
      "X-API-Timestamp": timestamp,
      "X-API-Nonce": nonce,
      "X-API-Signature": b64url(sig),
      // text/plain keeps the proxy from re-parsing the body, so the signed bytes arrive unchanged.
      ...(body ? { "Content-Type": PROXY ? "text/plain" : "application/json" } : {}),
    },
    body: body || undefined,
  });
  if (!res.ok) throw new Error(`Perpl ${method} ${target}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * Perpl's API has no CORS headers, so on web every call goes through our same-origin Vercel proxy
 * (apps/web-deploy/api/perpl.js), which relays the already-signed request.
 */
const PROXY = process.env.EXPO_PUBLIC_PERPL_PROXY ?? (Platform.OS === "web" ? "/api/perpl" : "");
const perplUrl = (target: string) => (PROXY ? `${PROXY}?target=${encodeURIComponent(target)}` : `${perpl.api}${target}`);

/** Use a key created on testnet.perpl.xyz/apikeys instead of enrolling one from the app. */
export async function importApiKey(token: string, secretHex: string) {
  const secret = secretHex.trim().startsWith("0x") ? secretHex.trim() : `0x${secretHex.trim()}`;
  if (!token.trim()) throw new Error("Enter the API key");
  if (!/^0x[0-9a-fA-F]{64}$/.test(secret)) throw new Error("The secret must be a 32-byte hex Ed25519 key");
  await storage.setJSON(KEY_STORE, { token: token.trim(), secretHex: secret } satisfies ApiKey);
  try {
    await getWallet(); // proves the key and signature work before we keep it
  } catch (e) {
    await storage.remove(KEY_STORE);
    throw e;
  }
}

export async function getContext(): Promise<{ markets: PerplMarket[]; tokens: PerplToken[] }> {
  const res = await fetch(perplUrl("/v1/pub/context"));
  if (!res.ok) throw new Error(`Perpl context: ${res.status}`);
  return res.json();
}

/** Enroll a trade-scoped Ed25519 key: the Mera account signs Perpl's EIP-712 payload. */
export async function enrollApiKey(account: LocalAccount) {
  const secret = ed.utils.randomSecretKey();
  const publicKey = bytesToHex(ed.getPublicKey(secret));
  const post = async (path: string, body: unknown) => {
    const res = await fetch(PROXY ? perplUrl(path) : `${perpl.enrollApi}${path}`, {
      method: "POST",
      headers: { "Content-Type": PROXY ? "text/plain" : "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Perpl ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  };

  const { typed_data, mac } = await post("/v1/api-key/payload", {
    chain_id: perpl.chainId,
    address: account.address,
    public_key: publicKey,
    scope_mask: 3,
    label: "GPUx mobile",
  });
  const { EIP712Domain: _domain, ...types } = typed_data.types;
  const typed = { domain: typed_data.domain, types, primaryType: typed_data.primaryType, message: typed_data.message };
  const signature = await account.signTypedData(typed);
  const pop_signature = bytesToHex(ed.sign(hexToBytes(hashTypedData(typed)), secret));
  const { api_key } = await post("/v1/api-key/enroll", {
    chain_id: perpl.chainId,
    address: account.address,
    typed_data,
    mac,
    signature,
    pop_signature,
  });
  await storage.setJSON(KEY_STORE, { token: api_key.api_key, secretHex: bytesToHex(secret) } satisfies ApiKey);
}

/** One-time onchain setup: fund an exchange account with AUSD collateral and allow API order forwarding. */
export async function setupExchangeAccount(wallet: Wallet, collateral: Address, amount: string, decimals: number) {
  const value = parseUnits(amount, decimals);
  await confirm(await wallet.writeContract({ address: collateral, abi: erc20Abi, functionName: "approve", args: [perpl.exchange, value] }));
  await confirm(await wallet.writeContract({ address: perpl.exchange, abi: perplExchangeAbi, functionName: "createAccount", args: [value] }));
  await confirm(
    await wallet.writeContract({ address: perpl.exchange, abi: perplExchangeAbi, functionName: "allowOrderForwarding", args: [true] }),
  );
}

// The live API returns accounts under `as` with string balances (docs say `accounts`).
export const getWallet = () => signed<{ as?: PerplAccount[] } & Record<string, unknown>>("GET", "/v1/trading/wallet");
export const getPositions = () => signed<{ sn: number; d: PerplPosition[] }>("GET", "/v1/trading/positions");

const scale = (v: number, decimals: number) => Math.round(v * 10 ** decimals);
export const unscale = (v: number, decimals: number) => v / 10 ** decimals;

let lastRq = 0;
const nextRq = () => (lastRq = Math.max(lastRq + 1, Date.now()));

/** Market (price undefined) or limit order. Leverage is in x, sent as hundredths. */
export async function placeOrder(o: {
  market: PerplMarket;
  account: number;
  type: (typeof OrderType)[keyof typeof OrderType];
  size: number;
  price?: number;
  leverage: number;
  flags?: number;
  slippageBps?: number;
}) {
  const { price_decimals, size_decimals } = o.market.config;
  const res = await signed<{ status: { code: number; error?: string }; statuses?: { code: number; error?: string }[] }>(
    "POST",
    "/v1/trading/orders",
    {
      d: [
        {
          rq: nextRq(),
          mkt: o.market.id,
          acc: o.account,
          t: o.type,
          p: o.price ? scale(o.price, price_decimals) : 0,
          s: scale(o.size, size_decimals),
          fl: o.flags ?? (o.price ? OrderFlag.GTC : OrderFlag.IOC),
          ms: o.slippageBps ?? 0,
          lv: Math.round(o.leverage * 100),
          lb: 0,
        },
      ],
    },
  );
  const st = res.statuses?.[0] ?? res.status;
  if (st.code !== 0) throw new Error(`Perpl rejected order: ${st.code} ${st.error ?? ""}`);
  return res;
}

/** Rough isolated-margin liquidation price; Perpl's API does not return one. */
export function estLiquidationPrice(p: PerplPosition, m: PerplMarket, maintenanceFrac = 0.05) {
  const entry = unscale(p.ep, m.config.price_decimals);
  const lev = p.lv / 100;
  const move = 1 / lev - maintenanceFrac;
  return p.sd === 1 ? entry * (1 - move) : entry * (1 + move);
}

export const blockNumber = () => publicClient.getBlockNumber();
