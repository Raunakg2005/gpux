# How Kimi became the trading copilot for an onchain GPU compute market

*Built for the Monad Metropolis hackathon · GPUx: https://gpux-web.vercel.app*

## The problem: trading compute shouldn't require reading an order book
GPUx is an onchain spot market for GPU compute on Monad. A GPU provider turns next week's H100 capacity into
ERC-20 "GPU-hour" tokens backed by a stablecoin bond; traders buy them on Kuru's onchain order books, and a
Chainlink CRE workflow verifies delivery, slashing the provider's bond to the buyer if it fails.

That is powerful, but the people who need compute (ML engineers, founders) don't think in "best ask on
the H100-EU-WEST book". They think "I need about 10 H100 hours in Europe this week, what will that cost?"
We wanted a copilot that understands that sentence and turns it into a safe, reviewable order.

## Why Kimi
We used **Kimi (kimi-k2.6) through Moonshot's OpenAI-compatible API** for three reasons:
1. **Reliable structured output.** In JSON mode Kimi returns `{reply, intent}` objects we can validate, so its
   answer becomes a concrete order (`buy`, `H100-EU-WEST`, `21.28 AUSD`) rather than prose.
2. **Good numeric reasoning over live data.** Each request includes a fresh market snapshot (best bid, best ask
   and the Chainlink index for every market), and Kimi does the "hours × ask" math and the "how far above the
   index is this?" comparison correctly.
3. **Drop-in integration.** An OpenAI-compatible endpoint meant the whole backend is one small serverless function.

## How it works
1. The user asks in the **Copilot** tab, e.g. *"Get me 10 H100 hours in Europe."*
2. Our Vercel function reads live state from Monad: Kuru `bestBidAsk()` for each GPU market and the latest
   price from the onchain `ComputeIndex` (published by Chainlink CRE).
3. It sends Kimi a system prompt containing that snapshot and strict rules: use only these markets and prices,
   suggest at most one order, compare it to the index, and answer only in JSON.
4. The server **validates** Kimi's intent against the real market list and drops anything unknown or malformed.
5. The app shows Kimi's answer and a **Review order** button that opens the market screen with side and amount
   pre-filled. The user checks the live order book and signs with their **passkey**.

**Kimi never moves funds.** It proposes and the human disposes: the passkey signature is the only way a trade happens.
The Kimi API key stays server-side as a secret environment variable.

## What Kimi brought to the project
- **A usable front door for non-traders.** "Cheapest GPU-hours right now?" and "Is B200 priced above its index?"
  get answered from live onchain data in one step.
- **Fewer mistakes.** Kimi converts hours into the right AUSD amount at the current ask and flags when a price is far
  above the Chainlink-CRE index, which is the same guardrail our MetaMask Agent Wallet plugin enforces for agents.
- **Speed of building.** JSON mode plus the OpenAI-compatible API took the copilot from idea to production in an
  afternoon, so we could spend hackathon time on the protocol (bonded contracts, Kuru markets, CRE settlement).

## Try it
Open https://gpux-web.vercel.app, create a passkey account (gas is sent automatically), open the **Copilot** tab
and ask for some GPU-hours. Code: https://github.com/Raunakg2005/gpux (`apps/web-deploy/api/copilot.js`,
`apps/mobile/src/app/(tabs)/copilot.tsx`).
