# GPUx indexer (Envio HyperIndex)

Bounty: Best Use of Envio. Powers Markets, Portfolio, Risk and provider reputation.

```bash
pnpm dlx envio init   # pick "Contract import", Monad testnet, paste deployed addresses
pnpm envio dev
```

## Entities to index
- `Series` ← `ComputeContractFactory.SeriesCreated`, `CapacityMinted`
- `Redemption` ← `DeliveryEscrow.RedemptionRequested`, `DeliverySettled`
- `Bond` ← `SLABondVault.Deposited / Locked / Released / Slashed`
- `Provider` ← `ProviderRegistry.ProviderRegistered`, `DeliveryRecorded`
- `IndexPoint` ← `ComputeIndex.IndexUpdated`
- `Fill` ← Kuru order book trade events for compute markets
