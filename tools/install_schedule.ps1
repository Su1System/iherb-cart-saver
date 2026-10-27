$ErrorActionPreference = 'Stop'
$cartSaverRoot = Split-Path -Parent $PSScriptRoot
$cartSaverName = 'iHerb Cart Saver - Official Offer Feed'
$cartSaverRunner = Join-Path $PSScriptRoot 'publish_offers.ps1'
if (!(Test-Path -LiteralPath (Join-Path $cartSaverRoot '.local\publisher-token.dpapi'))) { throw 'Configure the encrypted publishing token first.' }
$cartSaverExisting = Get-ScheduledTask -TaskName $cartSaverName -ErrorAction SilentlyContinue
if ($cartSaverExisting -and $cartSaverExisting.Actions.Arguments -notlike ('*' + $cartSaverRunner + '*')) { throw 'A different task already owns this name.' }
$cartSaverAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $cartSaverRunner + '"') -WorkingDirectory $cartSaverRoot
$cartSaverTrigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddSeconds(30)) -RepetitionInterval (New-TimeSpan -Hours 6)
$cartSaverSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 3)
$cartSaverPrincipal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $cartSaverName -Action $cartSaverAction -Trigger $cartSaverTrigger -Settings $cartSaverSettings -Principal $cartSaverPrincipal -Description 'Collect public iHerb AU/US/SG offers every 6 hours and publish verified JSON. No Chrome, cart, VPN or payment access.' -Force | Select-Object TaskName,State
