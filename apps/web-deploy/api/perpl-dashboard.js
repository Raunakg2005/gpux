// Vercel function: data for the public Perpl dashboard (/perpl).
// Protocol view: every Perpl testnet market (public context). Wallet view: the GPUx hedge-bot account,
// read with its API key (read-only calls; PERPL_API_KEY / PERPL_API_SECRET are Vercel secrets).
import { createHash, createPrivateKey, randomBytes, sign } from "node:crypto";

const API = "https://testnet.perpl.xyz/api";
const CHAIN_ID = 10143;
const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");

function signedHeaders(method, target) {
  const seed = Buffer.from(String(process.env.PERPL_API_SECRET || "").replace(/^0x/, ""), "hex");
  const key = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, seed]), format: "der", type: "pkcs8" });
  const ts = Date.now().toString();
  const nonce = randomBytes(16).toString("base64url");
  const canonical = [CHAIN_ID, method, target, ts, nonce, createHash("sha256").update("").digest("hex")].join("\n");
  return {
    "X-API-Key": process.env.PERPL_API_KEY,
    "X-API-Timestamp": ts,
    "X-API-Nonce": nonce,
    "X-API-Signature": sign(null, Buffer.from(canonical), key).toString("base64url"),
  };
}

async function get(target, signed) {
  const r = await fetch(`${API}${target}`, { headers: signed ? signedHeaders("GET", target) : {} });
  if (!r.ok) throw new Error(`${target}: ${r.status}`);
  return r.json();
}

const un = (v, d) => Number(v) / 10 ** d;

export default async function handler(req, res) {
  try {
    const ctx = await get("/v1/pub/context");
    const markets = ctx.markets.map((m) => {
      const pd = m.config.price_decimals;
      const sd = m.config.size_decimals;
      const s = m.state || {};
      const mark = un(s.mrk, pd);
      const oracle = un(s.orl, pd);
      const prev = s.prv ? un(s.prv, pd) : null;
      return {
        id: m.id,
        symbol: m.symbol,
        open: m.config.is_open,
        mark,
        oracle,
        basisBps: oracle ? ((mark - oracle) / oracle) * 1e4 : 0,
        bid: s.bid ? un(s.bid, pd) : null,
        ask: s.ask ? un(s.ask, pd) : null,
        change24hPct: prev ? ((mark - prev) / prev) * 100 : null,
        openInterest: s.oi ? un(s.oi, sd) : 0,
        openInterestUsd: s.oi ? un(s.oi, sd) * mark : 0,
        volume24h: s.dv ? un(s.dv, sd) : 0,
        volume24hUsd: s.dv ? un(s.dv, sd) * mark : 0,
        fundingRateRaw: m.funding?.rate ?? null,
        fundingIntervalSec: m.funding_interval_sec,
        takerFeeRaw: m.config.taker_fee,
        makerFeeRaw: m.config.maker_fee,
        priceDecimals: pd,
        sizeDecimals: sd,
      };
    });

    let wallet = null;
    if (process.env.PERPL_API_KEY && process.env.PERPL_API_SECRET) {
      const [w, p] = await Promise.all([get("/v1/trading/wallet", true), get("/v1/trading/positions", true)]);
      const acct = (w.as || [])[0];
      const positions = (p.d || []).map((pos) => {
        const m = markets.find((x) => x.id === pos.mkt);
        const size = un(pos.s, m.sizeDecimals);
        const entry = un(pos.ep, m.priceDecimals);
        const lev = pos.lv / 100;
        const short = pos.sd === 2;
        const notional = size * m.mark;
        const upnl = (m.mark - entry) * size * (short ? -1 : 1);
        const move = 1 / lev - 0.05; // ~5% maintenance (estimate)
        const liq = short ? entry * (1 + move) : entry * (1 - move);
        return {
          market: m.symbol,
          side: short ? "SHORT" : "LONG",
          size,
          entry,
          mark: m.mark,
          leverage: lev,
          notional,
          collateral: un(pos.c, 6),
          unrealizedPnl: upnl,
          estLiquidation: liq,
          distanceToLiqPct: (Math.abs(liq - m.mark) / m.mark) * 100,
        };
      });
      const balance = acct ? un(acct.b, 6) : 0;
      const locked = acct ? un(acct.lb, 6) : 0;
      wallet = {
        address: w.addr,
        accountId: acct?.id ?? null,
        forwarding: acct?.fw ?? false,
        balance,
        locked,
        positions,
        totalNotional: positions.reduce((a, x) => a + x.notional, 0),
        totalUnrealizedPnl: positions.reduce((a, x) => a + x.unrealizedPnl, 0),
        nearestLiqPct: positions.length ? Math.min(...positions.map((x) => x.distanceToLiqPct)) : null,
      };
    }

    res.setHeader("cache-control", "s-maxage=3");
    return res.status(200).json({ at: Date.now(), markets, wallet });
  } catch (e) {
    return res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) });
  }
}
