# GPUx submission kit

Deadline: **14 Oct 2026, 09:29 IST**. Track: **Onchain Finance & Trading**.

## Checklist
- [ ] Logo: `docs/logo.png` (upload as JPG/PNG/WEBP, under 3 MB)
- [x] Public GitHub repo: https://github.com/Raunakg2005/gpux (metropolis@hackathon.monad.xyz added)
- [ ] Technical demo video, max 3 min, **live product** (script below) → upload to YouTube (unlisted) or Loom
- [ ] Pitch video, max 2 min (script below)
- [x] Live product: https://gpux-web.vercel.app (Monad Testnet; any passkey works; gas is automatic)
- [ ] Select sponsor bounties: Agora Mobile Trading, Kuru ×2, Perpl ×2, Mera ×2, Chainlink CRE, Nansen, Envio, MetaMask, Kimi, Community (if eligible)

Access instructions for judges (paste into the form):
> Open https://gpux-web.vercel.app on a phone or Chrome/Edge → Create account (passkey, no seed phrase). Testnet MON for gas is sent automatically.
> Portfolio → Testnet AUSD → Markets → H100 US-EAST → Buy. No login credentials needed.

---

## 3-minute technical demo (screen recording of the live app)
Record on your phone screen or Chrome's mobile view. Keep the Monad explorer open in a second tab.

| Time | Show | Say |
|---|---|---|
| 0:00–0:15 | App home | "GPUx is an onchain spot market for GPU compute on Monad. Every GPU-hour is a token, backed by the provider's bond." |
| 0:15–0:35 | Create account (passkey prompt) | "Sign-up is one passkey through Mera: no seed phrase, no extension. Gas arrives automatically." |
| 0:35–0:50 | Portfolio → Testnet AUSD | "AUSD is the settlement currency." |
| 0:50–1:25 | Markets → H100 US-EAST: book, bond, reliability, Buy 10 AUSD | "Each contract has its own Kuru order book. Real depth, provider reliability and bond coverage. I buy 10 dollars of H100 hours… settled onchain in under a second." Show *Recent trades · indexed by Envio*. |
| 1:25–1:55 | Redeem 1 hour → Vault → Reveal key | "To use the compute I redeem. The access key is sealed with my passkey's PRF, a second key from the same passkey. Only its hash goes onchain." |
| 1:55–2:20 | Show terminal: `cre workflow simulate … --broadcast`, then Portfolio delivery = Delivered | "A Chainlink CRE workflow checks provider telemetry with node consensus and settles delivery. If the provider fails, the bond is slashed to me." |
| 2:20–2:40 | Hedge bot terminal tab + Risk tab | "Providers hedge: our bot sizes a Perpl short from inventory and tilts it with Nansen smart-money flows. It's live on account 1161." |
| 2:40–3:00 | Copilot tab "Get me 10 H100 hours in Europe" → Review order; or `mm gpux quote` | "Agents can trade too: a Kimi copilot and a MetaMask Agent Wallet plugin, both behind guardrails tied to the Chainlink index." |

## 2-minute pitch (camera on you)
1. **Problem (25s)**: "Compute is the commodity of this decade, but it trades like it's 1995: bilateral deals, no spot price, no hedging, and if your provider flakes you just lose the week. Lenders charge 5%+ extra on GPU-backed loans because nobody can price the risk."
2. **Solution (35s)**: "GPUx turns a GPU-hour into a bonded token. Providers pre-sell capacity on a real order book on Monad; buyers get a price, a hedge, and an automatic refund: Chainlink verifies delivery and slashes the provider's bond if it fails."
3. **Why now / why Monad (20s)**: "CME and ICE are only now announcing compute futures. A spot market has to come first, and an onchain order book only works with Monad's sub-second finality."
4. **First users (20s)**: "Our first sellers are small neoclouds with idle H100s; our first buyers are seed-stage AI startups who need predictable training compute."
5. **Traction & next (20s)**: "It's live on Monad testnet today: markets on Kuru, CRE-settled deliveries, an Envio index, a live Perpl hedge. Next: three provider LOIs and $250k of contract notional in the first quarter on mainnet."

## Bounty one-liners (for the form)
- **Agora Mobile Trading**: mobile-first app, Mera passkey login, AUSD balance, perps via Perpl (Hedge tab + live bot).
- **Kuru New Assets & Markets**: GPU-hours as a new tradable asset class; four Kuru markets plus listing infrastructure (`scripts/deploy-kuru-markets.ts`).
- **Kuru Consumer Trading**: focused spot UI routing every trade through Kuru's book.
- **Perpl API**: production-style hedge bot (bands, liq guard, dry run) trading live. **Perpl Analytics/Risk**: Risk tab health score, liquidation distance, hedge ratio.
- **Mera UX**: Mera is the entire account layer. **Mera PRF**: sealed notes and compute access tokens via passkey PRF vaults.
- **Chainlink CRE**: log-triggered delivery oracle with HTTP consensus + cron index publisher writing via a ReceiverTemplate contract.
- **Nansen**: smart-money perp flows drive hedge sizing. **Envio**: hosted HyperIndex powering app data.
- **MetaMask Agent Wallet**: `mm gpux` plugin adds compute trading with index-linked guardrails.
- **Kimi**: copilot turns plain-English requests into reviewable orders using live market data.
