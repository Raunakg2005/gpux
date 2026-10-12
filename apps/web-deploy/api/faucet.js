// Vercel serverless function: sends a small amount of testnet MON to new GPUx accounts so
// passkey users (and judges) can pay gas. Funded by a dedicated faucet hot wallet whose key
// lives only in the Vercel env var FAUCET_PRIVATE_KEY.
import { createPublicClient, createWalletClient, formatEther, http, isAddress, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

// Monad reserves the full gas limit per tx (~0.02-0.03 MON each), so give enough for ~6-8 txs.
const DRIP = parseEther("0.2");
const ELIGIBLE_BELOW = parseEther("0.08"); // only top up nearly-empty accounts
const transport = http(process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const address = req.body?.address;
  if (typeof address !== "string" || !isAddress(address)) return res.status(400).json({ error: "invalid address" });
  if (!process.env.FAUCET_PRIVATE_KEY) return res.status(500).json({ error: "faucet not configured" });

  try {
    const pub = createPublicClient({ chain: monadTestnet, transport });
    const balance = await pub.getBalance({ address });
    if (balance >= ELIGIBLE_BELOW) {
      return res.status(200).json({ funded: false, reason: "already has gas", balance: formatEther(balance) });
    }
    const account = privateKeyToAccount(process.env.FAUCET_PRIVATE_KEY);
    const wallet = createWalletClient({ account, chain: monadTestnet, transport });
    const hash = await wallet.sendTransaction({ to: address, value: DRIP });
    await pub.waitForTransactionReceipt({ hash });
    return res.status(200).json({ funded: true, amount: formatEther(DRIP), tx: hash });
  } catch (e) {
    return res.status(500).json({ error: String(e?.shortMessage || e?.message || e).slice(0, 200) });
  }
}
