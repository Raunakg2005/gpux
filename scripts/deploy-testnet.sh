#!/usr/bin/env bash
# One command: deploy GPUx contracts, seed demo data, list markets on Kuru, write apps/mobile/.env.
# Needs gpux/.env with DEPLOYER_PRIVATE_KEY (funded with testnet MON) and MONAD_RPC_URL.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
FORGE="${FORGE:-forge}"
command -v "$FORGE" >/dev/null || FORGE="$USERPROFILE/.foundry/bin/forge.exe"

(cd contracts && "$FORGE" script script/Deploy.s.sol --rpc-url "$MONAD_RPC_URL" --broadcast --slow)
(cd contracts && "$FORGE" script script/Seed.s.sol --rpc-url "$MONAD_RPC_URL" --broadcast --slow)
(cd scripts && npx tsx deploy-kuru-markets.ts)
echo "Done. Addresses in contracts/deployments/, app config in apps/mobile/.env"
