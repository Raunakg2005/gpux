// Vercel function: GPUx trading copilot powered by Kimi (Moonshot AI).
// Reads a live market snapshot (Kuru best bid/ask + Chainlink-CRE index) and turns a plain-English
// request into a reply plus a suggested order. It never trades: the app pre-fills the order and the
// user confirms with their passkey. KIMI_API_KEY lives only in Vercel env.
import { createPublicClient, encodeAbiParameters, formatUnits, http, keccak256, parseAbi } from "viem";
import { monadTestnet } from "viem/chains";

const MARKETS = [
  { id: "H100-US-EAST", seriesId: 0, gpu: "H100", region: "US-EAST", book: "0xF79897971C1C495A1Ca43C15EE81589b9De1102f" },
  { id: "H100-EU-WEST", seriesId: 1, gpu: "H100", region: "EU-WEST", book: "0xb0Cd07612a2E7db094DCB6f563866B9D4009dF64" },
  { id: "A100-US-EAST", seriesId: 2, gpu: "A100", region: "US-EAST", book: "0x2a7CC86E7817Ce15290B2059F54222404ba15894" },
  { id: "B200-US-WEST", seriesId: 3, gpu: "B200", region: "US-WEST", book: "0x88540C94471C377d1faa80b6D6309ABCcdBE3032" },
];
const INDEX = "0x2e58B0f2336dFe76b8bbAb1BfD927E354CBC997F";
const bookAbi = parseAbi(["function bestBidAsk() view returns (uint256, uint256)"]);
const indexAbi = parseAbi(["function latest(bytes32) view returns (uint128 price, uint64 timestamp)"]);
const client = createPublicClient({ chain: monadTestnet, batch: { multicall: true }, transport: http("https://testnet-rpc.monad.xyz") });

async function snapshot() {
  return Promise.all(
    MARKETS.map(async (m) => {
      const key = keccak256(encodeAbiParameters([{ type: "string" }, { type: "string" }], [m.gpu, m.region]));
      const [[bid, ask], [index]] = await Promise.all([
        client.readContract({ address: m.book, abi: bookAbi, functionName: "bestBidAsk" }),
        client.readContract({ address: INDEX, abi: indexAbi, functionName: "latest", args: [key] }),
      ]);
      return {
        market: m.id,
        seriesId: m.seriesId,
        bestBid: Number(formatUnits(bid, 18)),
        bestAsk: Number(formatUnits(ask, 18)),
        indexPrice: Number(formatUnits(index, 6)),
      };
    }),
  );
}

const SYSTEM = (snap) => `You are the GPUx trading copilot. GPUx sells bonded GPU-hour contracts (1 token = 1 GPU-hour of the stated GPU, region and delivery week) on Monad testnet, priced in AUSD (a dollar stablecoin). If the provider fails to deliver, its bond is slashed and paid to the buyer.
Live markets (prices in AUSD per GPU-hour): ${JSON.stringify(snap)}
Rules:
- Answer briefly and concretely using the live numbers. Never invent markets or prices.
- If the user wants to trade, suggest ONE order. For buys "amount" is AUSD to spend (hours x bestAsk, rounded up to 2 decimals); for sells "amount" is GPU-hours.
- Mention the price versus the index. Remind them they confirm with their passkey.
- Refuse anything unrelated to GPUx trading in one sentence.
Respond ONLY with JSON: {"reply": string, "intent": {"action": "buy"|"sell"|"none", "market": string|null, "seriesId": number|null, "amount": number|null}}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const message = String(req.body?.message ?? "").slice(0, 500);
  if (!message.trim()) return res.status(400).json({ error: "empty message" });
  if (!process.env.KIMI_API_KEY) return res.status(500).json({ error: "copilot not configured" });

  try {
    const snap = await snapshot();
    const r = await fetch("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.KIMI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.KIMI_MODEL || "kimi-k2.6",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM(snap) },
          { role: "user", content: message },
        ],
      }),
    });
    const body = await r.json();
    if (!r.ok) return res.status(502).json({ error: body?.error?.message?.slice(0, 200) ?? `Kimi error ${r.status}` });
    const out = JSON.parse(body.choices[0].message.content);
    const intent = out.intent ?? { action: "none" };
    // Only pass through intents that reference a real market.
    const known = MARKETS.find((m) => m.id === intent.market);
    const safe =
      known && ["buy", "sell"].includes(intent.action) && Number(intent.amount) > 0
        ? { action: intent.action, market: known.id, seriesId: known.seriesId, amount: Number(intent.amount) }
        : { action: "none" };
    return res.status(200).json({ reply: String(out.reply ?? ""), intent: safe, snapshot: snap });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message ?? e).slice(0, 200) });
  }
}
