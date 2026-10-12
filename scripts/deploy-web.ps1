# Builds the Expo web app and deploys it, with the /api/faucet gas function, to Vercel (project gpux-web).
# Run from the user's own PowerShell (it needs their Vercel login):  & .\scripts\deploy-web.ps1
# Not "Stop": PowerShell 5.1 turns the Vercel CLI's stderr status lines into terminating errors.
$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
$out = Join-Path (Split-Path -Parent $repo) "gpux-web"   # holds the .vercel project link

Push-Location (Join-Path $repo "apps\mobile")
npx expo export -p web
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "expo export failed" }
Pop-Location

New-Item -ItemType Directory -Force $out | Out-Null
Copy-Item -Recurse -Force (Join-Path $repo "apps\mobile\dist\*") $out
Copy-Item -Recurse -Force (Join-Path $repo "apps\web-deploy\api") $out
Copy-Item -Force (Join-Path $repo "apps\web-deploy\package.json"), (Join-Path $repo "apps\web-deploy\vercel.json") $out

Push-Location $out
# Store the faucet key as a Vercel secret once (value read from gpux/.env, never printed).
$existing = (vercel env ls production --non-interactive 2>&1) -join "`n"
if ($existing -notmatch "FAUCET_PRIVATE_KEY") {
  $line = Get-Content (Join-Path $repo ".env") | Where-Object { $_ -match "^FAUCET_PRIVATE_KEY=" } | Select-Object -First 1
  if (-not $line) { throw "FAUCET_PRIVATE_KEY missing from gpux/.env" }
  $line.Substring("FAUCET_PRIVATE_KEY=".Length).Trim() | vercel env add FAUCET_PRIVATE_KEY production --sensitive --yes --force
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "could not store FAUCET_PRIVATE_KEY in Vercel" }
}
# Copilot key (Kimi), same pattern: stored once as a sensitive Vercel env var.
if ($existing -notmatch "KIMI_API_KEY") {
  $kline = Get-Content (Join-Path $repo ".env") | Where-Object { $_ -match "^KIMI_API_KEY=" } | Select-Object -First 1
  if ($kline) {
    $kline.Substring("KIMI_API_KEY=".Length).Trim() | vercel env add KIMI_API_KEY production --sensitive --yes --force
  }
}
vercel deploy --prod --yes
Pop-Location
