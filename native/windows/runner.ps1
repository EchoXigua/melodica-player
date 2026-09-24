param([string]$Mode, [string]$Plan, [string]$Target, [int]$Owner, [string]$StopFile)
$ErrorActionPreference = 'Stop'
try {
 Add-Type -Path (Join-Path $PSScriptRoot 'InputEngine.cs')
 if ($Mode -eq 'list') { [Melodica.InputEngine]::List() }
 elseif ($Mode -eq 'release') { [Melodica.InputEngine]::Release() }
 elseif ($Mode -eq 'play') { [Melodica.InputEngine]::Play($Plan, $Target, $Owner, $StopFile) }
 else { throw 'Unknown mode' }
} catch { Write-Output ('ERROR ' + $_.Exception.Message); exit 1 }
