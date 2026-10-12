# GPUx Chainlink CRE workflows

CRE is GPUx's orchestration layer. `GPUxCREReceiver` (a Chainlink `ReceiverTemplate`) is the
only address allowed to settle deliveries in `DeliveryEscrow` and to publish `ComputeIndex`
prices, so both happen only through DON-signed workflow reports.

## `delivery-verifier` workflow
| Trigger | Does |
|---|---|
| 0: EVM log `DeliveryEscrow.RedemptionRequested` | Reads the redemption + series onchain, fetches provider telemetry over HTTP on every node (`consensusIdenticalAggregation`), and writes a report that settles the redemption: delivered = bond released to provider, failed = bond slashed to the buyer |
| 1: Cron (every 5 min) | Reads `bestBidAsk()` on every Kuru compute market, takes the mid, publishes all prices to `ComputeIndex` in one report |

Telemetry source (mock provider): `mock-provider/telemetry.json`, served from GitHub raw.
A provider meets its SLA when `uptimeBps >= slaUptimeBps`; ids in `failedRedemptions` demo slashing.

## Run (Monad testnet)
Requires the CRE CLI (`cre login`) and Bun.
```bash
cd contracts && bun install --ignore-scripts && cd ../delivery-verifier && bun install && cd ..
export CRE_ETH_PRIVATE_KEY=<deployer key without 0x>

# Index publisher
cre workflow simulate delivery-verifier -T staging-settings --trigger-index 1 --broadcast

# Delivery verifier, replaying a real RedemptionRequested event
cre workflow simulate delivery-verifier -T staging-settings --trigger-index 0 \
  --evm-tx-hash <redeem tx hash> --evm-event-index 1 --broadcast
```

## Verified onchain runs (Monad testnet)
- Receiver: `0xeF963E63d15C2f27baC25b2F7804440B7fdA4c7D` (forwarder = Monad testnet mock forwarder `0xB9F79d86…d192`)
- Delivery settled by CRE: tx `0x9ab84619d943277df468b6b6e15c495d3f6b16bfcbfb784c68f538e52d3990cf` (redemption #0, Pending → Delivered)
- Index published by CRE: tx `0xc90dea30f28a4a850509f0e24961a78de41ff00f0130865d4a3f9d5e72f12874` (4 markets)

For a deployed workflow, point the receiver at the real forwarder with
`setForwarderAddress(0xF8344CFd5c43616a4366C34E3EEE75af79a74482)`.

Bindings in `contracts/evm/ts/generated` come from `cre generate-bindings evm -l typescript`
using the ABIs in `contracts/evm/src/abi`.
