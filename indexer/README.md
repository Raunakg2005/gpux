# GPUx indexer (Envio HyperIndex)

Indexes GPUx on Monad testnet (chain 10143) via HyperSync:

| Entity | Source |
|---|---|
| `Series` | `ComputeContractFactory.SeriesCreated / CapacityMinted`; each series' `ComputeToken` is registered dynamically |
| `Holding` | `ComputeToken.Transfer` (per user balances) |
| `Redemption` | `DeliveryEscrow.RedemptionRequested`, settled by `DeliverySettled` (written by the Chainlink CRE workflow) |
| `Provider` | `ProviderRegistry` + `SLABondVault` (deliveries ok/failed, bond posted/slashed) |
| `IndexPoint` | `ComputeIndex.IndexUpdated` (CRE index publisher) |
| `Fill`, `MarketStats` | Kuru order book `Trade` events on the four compute markets |

## Run
Envio does not run natively on Windows; use WSL or Linux/macOS.
```bash
pnpm install
echo "ENVIO_API_TOKEN=..." > .env   # https://envio.dev/app/api-tokens
pnpm codegen
pnpm test        # replays the real testnet history and checks every entity
pnpm dev         # local indexer + GraphQL (needs Docker)
```

Hosted: Envio Cloud deploys this folder from the `envio` branch.
