# Chainlink CRE workflows

Bounty: Best workflow with CRE. CRE is the orchestration layer of GPUx.

Scaffold with the CRE CLI (`cre init`) per Chainlink docs, one workflow per folder:

| Workflow | Trigger | Does |
|---|---|---|
| `delivery-verifier` | EVM log `RedemptionRequested` | Polls provider uptime API (mock in `mock-provider/`), calls `DeliveryEscrow.settle(id, ok)` |
| `index-publisher` | Cron every 5 min | Reads Kuru fills, computes TWAP, calls `ComputeIndex.publish` |
| `auto-roll` | Cron daily | Rolls expiring positions to the next delivery week |
| `risk-guard` | Cron 1 min | Checks Perpl margin; triggers auto-deleverage for opted-in users |

Set the CRE forwarder address as `CRE_FORWARDER` when running `contracts/script/Deploy.s.sol`.
