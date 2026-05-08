[CmdletBinding()]
param([string]$Name, [switch]$Help)
. "$PSScriptRoot/../tools/_common.ps1"
if ($Help -or -not $Name) {
    Show-HelpAndExit -ScriptName 'v3-agent-inspector.ps1' `
        -Synopsis 'Print full spec + capability summary for an agent.' `
        -Examples @('./tools-v3/v3-agent-inspector.ps1 -Name domain-agent')
}

Assert-PowerShellYaml
$root = Get-PlatformRoot
$file = Join-Path $root "agents/$Name.yml"
if (-not (Test-Path $file)) {
    Write-Error "Agent not found: $file"
    exit $global:EXIT_VALIDATION
}

$a = Read-Yaml $file
if (-not $a) { exit $global:EXIT_SCHEMA }

Write-StepHeader "AGENT: $($a.name) v$($a.version)"
Write-Host "Role:    $($a.role)"
Write-Host "Owners:  $($a.owners -join ', ')"
Write-Host ''
Write-Host 'Capabilities:' -ForegroundColor Cyan
$a.capabilities | ForEach-Object { Write-Host "  - $_" }
if ($a.sla) {
    Write-Host ''
    Write-Host "SLA: p50=$($a.sla.p50_latency_ms)ms p99=$($a.sla.p99_latency_ms)ms availability=$($a.sla.availability)" -ForegroundColor DarkCyan
}
if ($a.error_handling) {
    Write-Host ''
    Write-Host 'Error handling:' -ForegroundColor Cyan
    foreach ($k in $a.error_handling.Keys) { Write-Host "  $k -> $($a.error_handling[$k])" }
}
exit $global:EXIT_OK
