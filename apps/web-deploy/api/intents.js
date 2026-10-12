// Vercel function: any-chain deposits into Monad via Aurora Intents (powered by NEAR Intents 1Click).
// ops: GET ?op=tokens  -> curated origin assets + Monad destinations
//      POST ?op=quote  -> { originAssetId, destinationAssetId, amount (smallest unit), recipient }
//      GET ?op=status&depositAddress=...
// ONECLICK_API_KEY (optional, Vercel env) removes the 0.25% unauthenticated fee.
const API = "https://1click.chaindefuser.com/v0";
const ORIGINS = [
  ["base", "USDC"], ["arb", "USDC"], ["eth", "USDC"], ["sol", "USDC"], ["bsc", "USDC"], ["pol", "USDC"],
  ["base", "ETH"], ["arb", "ETH"], ["eth", "ETH"], ["sol", "SOL"], ["btc", "BTC"], ["near", "NEAR"],
];
const DESTINATIONS = [["monad", "USDC"], ["monad", "MON"], ["monad", "USDT0"]];

const headers = () => ({
  "content-type": "application/json",
  ...(process.env.ONECLICK_API_KEY ? { "X-API-Key": process.env.ONECLICK_API_KEY } : {}),
});

async function tokens() {
  const all = await (await fetch(`${API}/tokens`, { headers: headers() })).json();
  const find = ([chain, symbol]) => all.find((t) => t.blockchain === chain && t.symbol === symbol);
  const shape = (t) => t && { assetId: t.assetId, chain: t.blockchain, symbol: t.symbol, decimals: t.decimals, price: t.price };
  return { origins: ORIGINS.map(find).map(shape).filter(Boolean), destinations: DESTINATIONS.map(find).map(shape).filter(Boolean) };
}

export default async function handler(req, res) {
  const op = String(req.query?.op ?? "");
  try {
    if (op === "tokens" && req.method === "GET") {
      res.setHeader("cache-control", "s-maxage=300");
      return res.status(200).json(await tokens());
    }
    if (op === "quote" && req.method === "POST") {
      const { originAssetId, destinationAssetId, amount, recipient, refundTo, dry } = req.body ?? {};
      if (!/^\d+$/.test(String(amount ?? ""))) return res.status(400).json({ error: "amount must be an integer string in the smallest unit" });
      if (!/^0x[0-9a-fA-F]{40}$/.test(String(recipient ?? ""))) return res.status(400).json({ error: "recipient must be your Monad (EVM) address" });
      const { destinations } = await tokens();
      if (!destinations.some((d) => d.assetId === destinationAssetId)) return res.status(400).json({ error: "destination must be a Monad asset" });
      const body = {
        dry: Boolean(dry),
        swapType: "EXACT_INPUT",
        slippageTolerance: 100,
        originAsset: originAssetId,
        depositType: "ORIGIN_CHAIN",
        destinationAsset: destinationAssetId,
        amount: String(amount),
        // Refunds go back on the origin chain; EVM origins default to the same passkey address.
        refundTo: refundTo || recipient,
        refundType: "ORIGIN_CHAIN",
        recipient,
        recipientType: "DESTINATION_CHAIN",
        deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        referral: "gpux",
        quoteWaitingTimeMs: 3000,
      };
      const r = await fetch(`${API}/quote`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: j.message ?? JSON.stringify(j).slice(0, 200) });
      const q = j.quote;
      return res.status(200).json({
        depositAddress: q.depositAddress ?? null,
        depositMemo: q.depositMemo ?? null,
        amountInFormatted: q.amountInFormatted,
        amountOutFormatted: q.amountOutFormatted,
        amountOutUsd: q.amountOutUsd,
        timeEstimate: q.timeEstimate,
        deadline: q.deadline ?? null,
        correlationId: j.correlationId,
      });
    }
    if (op === "status" && req.method === "GET") {
      const depositAddress = String(req.query?.depositAddress ?? "");
      if (!depositAddress) return res.status(400).json({ error: "depositAddress required" });
      const r = await fetch(`${API}/status?depositAddress=${encodeURIComponent(depositAddress)}`, { headers: headers() });
      const j = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: j.message ?? `status ${r.status}` });
      return res.status(200).json({
        status: j.status,
        amountOutFormatted: j.swapDetails?.amountOutFormatted ?? null,
        destinationTx: j.swapDetails?.destinationChainTxHashes?.[0] ?? null,
        originTx: j.swapDetails?.originChainTxHashes?.[0] ?? null,
      });
    }
    return res.status(400).json({ error: "unknown op" });
  } catch (e) {
    return res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) });
  }
}
