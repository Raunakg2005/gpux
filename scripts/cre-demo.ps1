# Runs the GPUx Chainlink CRE workflow against Monad testnet with --broadcast (for demos).
#   Index publisher:   .\scripts\cre-demo.ps1
#   Delivery verifier: .\scripts\cre-demo.ps1 -RedeemTx 0x<hash of a redeem transaction>
param([string]$RedeemTx = "")

$repo = Split-Path -Parent $PSScriptRoot
$line = Get-Content (Join-Path $repo ".env") | Where-Object { $_ -match "^DEPLOYER_PRIVATE_KEY=" } | Select-Object -First 1
if (-not $line) { throw "DEPLOYER_PRIVATE_KEY missing from gpux/.env" }
# CRE wants the key without 0x; it is only set for this process and never printed.
$env:CRE_ETH_PRIVATE_KEY = $line.Substring("DEPLOYER_PRIVATE_KEY=".Length).Trim().Trim('"') -replace '^0x', ''
$env:Path = "$env:USERPROFILE\.bun\bin;$env:LOCALAPPDATA\Programs\cre;$env:Path"

Push-Location (Join-Path $repo "cre-workflows")
try {
  if ($RedeemTx) {
    Write-Host "Chainlink CRE delivery verifier <- RedemptionRequested in $RedeemTx" -ForegroundColor Cyan
    # The RedemptionRequested log is the 2nd log in a redeem tx (after the token burn).
    cre workflow simulate delivery-verifier -T staging-settings --non-interactive --trigger-index 0 --evm-tx-hash $RedeemTx --evm-event-index 1 --broadcast
  } else {
    Write-Host "Chainlink CRE index publisher (cron) <- Kuru order books" -ForegroundColor Cyan
    cre workflow simulate delivery-verifier -T staging-settings --non-interactive --trigger-index 1 --broadcast
  }
} finally {
  Pop-Location
  Remove-Item Env:CRE_ETH_PRIVATE_KEY -ErrorAction SilentlyContinue
}
