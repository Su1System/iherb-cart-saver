$ErrorActionPreference = 'Stop'
$cartSaverRoot = Split-Path -Parent $PSScriptRoot
$cartSaverSecretFile = Join-Path $cartSaverRoot '.local\publisher-token.dpapi'
$cartSaverLog = Join-Path $cartSaverRoot '.local\publisher-last.log'
$cartSaverPython = (Get-Content -LiteralPath (Join-Path $cartSaverRoot '.local\publisher-python.txt') -Raw).Trim()
$cartSaverSecure = (Get-Content -LiteralPath $cartSaverSecretFile -Raw).Trim() | ConvertTo-SecureString
$cartSaverCredential = [System.Management.Automation.PSCredential]::new('feed', $cartSaverSecure)
$env:IHERB_FEED_TOKEN = $cartSaverCredential.GetNetworkCredential().Password
try {
    & $cartSaverPython -X utf8 (Join-Path $PSScriptRoot 'publish_offers.py') *> $cartSaverLog
    $cartSaverExit = $LASTEXITCODE
} finally {
    Remove-Item Env:IHERB_FEED_TOKEN -ErrorAction SilentlyContinue
}
exit $cartSaverExit
