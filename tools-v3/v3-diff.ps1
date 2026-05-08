[CmdletBinding()]
param([string]$A, [string]$B, [switch]$Help)
. "$PSScriptRoot/../tools/_common.ps1"
if ($Help -or -not $A -or -not $B) {
    Show-HelpAndExit -ScriptName 'v3-diff.ps1' `
        -Synopsis 'Diff two jurisdiction rule files: rule ids, severities, citations.' `
        -Examples @('./tools-v3/v3-diff.ps1 -A us -B eu')
}

Assert-PowerShellYaml
$root = Get-PlatformRoot
$fa = Join-Path $root "agents/legal-rules/$A.yml"
$fb = Join-Path $root "agents/legal-rules/$B.yml"
foreach ($f in $fa,$fb) {
    if (-not (Test-Path $f)) { Write-Error "Not found: $f"; exit $global:EXIT_VALIDATION }
}

$ya = Read-Yaml $fa
$yb = Read-Yaml $fb

$ida = @($ya.rules | ForEach-Object { $_.id })
$idb = @($yb.rules | ForEach-Object { $_.id })

Write-StepHeader "DIFF $A  vs  $B"
Write-Host ''
Write-Host "[$A] only:" -ForegroundColor Cyan
($ida | Where-Object { $_ -notin $idb }) | ForEach-Object { Write-Host "  + $_" }
Write-Host ''
Write-Host "[$B] only:" -ForegroundColor Cyan
($idb | Where-Object { $_ -notin $ida }) | ForEach-Object { Write-Host "  + $_" }
Write-Host ''
Write-Host 'Common rule ids:' -ForegroundColor Cyan
($ida | Where-Object { $_ -in $idb }) | ForEach-Object { Write-Host "  = $_" }
exit $global:EXIT_OK
