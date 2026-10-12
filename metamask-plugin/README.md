# MetaMask Agent Wallet plugin: "Compute Trading"

Bounty: Best Agent Wallet Plugin. Gives the agent a new trading superpower: buy, sell, TWAP and hedge GPU compute.

Actions to expose (via the Agent Wallet plugin architecture; follow MetaMask docs):
- `getComputeQuote(gpuType, region, hours)`
- `buyCompute(seriesId, hours, maxPrice, strategy)` → Kuru
- `hedgeCompute(seriesId, ratio)` → Perpl
- `redeemCompute(seriesId, hours)` → DeliveryEscrow

Reuses order logic from `services/ai-agents` and addresses from `@gpux/shared`.
