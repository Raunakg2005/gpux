import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  createSecretVaultWithExistingPasskey,
  decryptSecretVaultWithPasskey,
  getPasskeyPrfOutput,
  isMeraError,
  type PasskeyCredentialMetadata,
  type PasskeySecretVault,
  type Secp256k1SigningSession,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import type { LocalAccount } from "viem";
import { RP_ID, RP_NAME } from "./config";
import { storage } from "./storage";
import { webAuthnClient } from "./webauthn";

/**
 * Mera is the entire account layer: one passkey -> PRF output -> BIP-44 EVM key.
 * No seed phrase shown, no extension, no custody backend. The key lives only in a
 * signing session in memory and is zeroed on sign-out.
 */
const CREDENTIAL_KEY = "gpux.credential";

let session: Secp256k1SigningSession | null = null;

function deriveEvmKey(prfOutput: Uint8Array, index = 0): Uint8Array {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  seed.fill(0);
  if (!node.privateKey) throw new Error("derivation produced no key");
  return node.privateKey;
}

function startSession(prfOutput: Uint8Array): LocalAccount {
  session?.end();
  const privateKey = deriveEvmKey(prfOutput);
  session = createSecp256k1SigningSession({ privateKey });
  privateKey.fill(0);
  prfOutput.fill(0);
  return toViemAccount(session);
}

export async function createAccount(displayName: string): Promise<LocalAccount> {
  const created = await createPasskeyWithPrfOutput({
    rp: { id: RP_ID, name: RP_NAME },
    user: { name: displayName, displayName },
    webAuthnClient,
  });
  await storage.setJSON(CREDENTIAL_KEY, { credentialId: created.credentialId, transports: created.transports });
  return startSession(created.prfOutput);
}

/** Sign in with the remembered passkey, or let the platform show its passkey picker. */
export async function signIn(): Promise<LocalAccount> {
  const known = (await storage.getJSON<PasskeyCredentialMetadata>(CREDENTIAL_KEY)) ?? undefined;
  const { prfOutput, credentialId } = await getPasskeyPrfOutput({ rpId: RP_ID, credential: known, webAuthnClient });
  if (!known) await storage.setJSON(CREDENTIAL_KEY, { credentialId });
  return startSession(prfOutput);
}

export async function hasKnownPasskey(): Promise<boolean> {
  return (await storage.get(CREDENTIAL_KEY)) !== null;
}

export function signOut() {
  session?.end();
  session = null;
}

/**
 * "One Passkey, Many Keys": non-wallet secrets sealed with the same passkey's PRF.
 * Each vault gets a fresh PRF salt, so every secret has an unrelated AES-256-GCM key.
 */
export async function sealSecret(secret: Uint8Array): Promise<PasskeySecretVault> {
  const credential = (await storage.getJSON<PasskeyCredentialMetadata>(CREDENTIAL_KEY)) ?? undefined;
  return createSecretVaultWithExistingPasskey({ rpId: RP_ID, credential, secret, webAuthnClient });
}

export async function openSecret(vault: PasskeySecretVault): Promise<Uint8Array> {
  return decryptSecretVaultWithPasskey({ rpId: RP_ID, vault, webAuthnClient });
}

export function describeMeraError(err: unknown): string {
  if (!isMeraError(err)) return err instanceof Error ? err.message : String(err);
  switch (err.code) {
    case "PRF_UNAVAILABLE":
      return "This passkey provider doesn't support PRF. Use iCloud Keychain (iOS 18+), Google Password Manager, or 1Password.";
    case "PASSKEY_OPERATION_FAILED":
      return "Passkey prompt was cancelled or failed.";
    case "CRYPTO_UNAVAILABLE":
      return "Secure crypto is unavailable. Open the app over HTTPS or localhost.";
    default:
      return err.message;
  }
}
