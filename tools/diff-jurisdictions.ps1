<#
.SYNOPSIS
  Diff two jurisdiction rule files and print added/removed/changed rule ids.
.PARAMETER A
  First jurisdiction code (e.g. us).
.PARAMETER B
  Second jurisdiction code (e.g. eu).
#>
[CmdletBinding()]
param(
  [string]$A,
  [string]$B,
  [switch]$Help
)

. (Join-Path $PSScriptRoot '_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }
Assert-PowerShellYaml
if (-not $A -or -not $B) { Write-Error '-A and -B are required'; exit $EXIT_VALIDATION }

$root = Get-PlatformRoot
function Load([string]$code) {
    $p = Join-Path $root "agents/legal-rules/$code.yml"
    if (-not (Test-Path $p)) { $p = Join-Path $root "agents/legal-rules/us-states/$($code -replace '^us-','').yml" }
    if (-not (Test-Path $p)) { Write-Error "No rules file for $code"; exit $EXIT_VALIDATION }
    Read-Yaml $p
}
$ya = Load $A
$yb = Load $B
$ida = @($ya.rules | ForEach-Object { $_.id })
$idb = @($yb.rules | ForEach-Object { $_.id })

Write-Host "=== Only in $A ===" -ForegroundColor Cyan
$ida | Where-Object { $_ -notin $idb }
Write-Host "=== Only in $B ===" -ForegroundColor Cyan
$idb | Where-Object { $_ -notin $ida }
Write-Host "=== Common ===" -ForegroundColor Cyan
$ida | Where-Object { $_ -in $idb }
exit $EXIT_OK
