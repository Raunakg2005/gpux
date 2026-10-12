// Vercel function: same-origin proxy to Perpl's testnet REST API.
// Perpl's API sends no CORS headers, so the browser can't call it directly. The app signs every
// request itself (Ed25519 over chain/method/path/timestamp/nonce/body); this proxy only relays it,
// byte-for-byte, to an allowlist of endpoints. It never sees the signing key.
const BASE = process.env.PERPL_API || "https://testnet.perpl.xyz/api";
const ORIGIN = process.env.PUBLIC_ORIGIN || "https://gpux-web.vercel.app";
const ALLOWED = [/^\/v1\/pub\/context$/, /^\/v1\/trading\/(wallet|positions|orders)$/, /^\/v1\/api-key\/(payload|enroll)$/];
const FORWARD_HEADERS = ["x-api-key", "x-api-timestamp", "x-api-nonce", "x-api-signature"];

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  const target = String(req.query?.target ?? "");
  if (!ALLOWED.some((r) => r.test(target))) return res.status(400).json({ error: "target not allowed" });
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "GET/POST only" });

  const headers = {};
  for (const h of FORWARD_HEADERS) if (req.headers[h]) headers[h] = req.headers[h];
  // Key enrollment requires a whitelisted Origin: present our own site's origin.
  if (target.startsWith("/v1/api-key/")) headers.origin = ORIGIN;

  // Read the raw body (never req.body): re-serialising JSON would break the signed body hash.
  const body = req.method === "POST" ? await rawBody(req) : undefined;
  if (body) headers["content-type"] = "application/json";

  try {
    const upstream = await fetch(`${BASE}${target}`, { method: req.method, headers, body });
    const text = await upstream.text();
    res.status(upstream.status).setHeader("content-type", upstream.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: String(e?.message ?? e).slice(0, 200) });
  }
}
