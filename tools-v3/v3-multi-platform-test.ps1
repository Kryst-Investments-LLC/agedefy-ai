[CmdletBinding()]
param([switch]$Help)
. "$PSScriptRoot/../tools/_common.ps1"
if ($Help) {
    Show-HelpAndExit -ScriptName 'v3-multi-platform-test.ps1' `
        -Synopsis 'Run platform-dev Test-Platform for every sibling AI platform under ../.' `
        -Examples @('./tools-v3/v3-multi-platform-test.ps1')
}

$root      = Get-PlatformRoot
$siblings  = Get-ChildItem (Split-Path $root -Parent) -Directory |
             Where-Object { Test-Path (Join-Path $_.FullName 'tools/platform-dev.ps1') }

$failed = 0
foreach ($p in $siblings) {
    Write-StepHeader "TEST: $($p.Name)"
    try {
        & (Join-Path $p.FullName 'tools/platform-dev.ps1') -Action Test
    } catch {
        $failed++
        Write-Host "FAILED: $($p.Name) — $_" -ForegroundColor Red
    }
}

if ($failed -gt 0) { exit $global:EXIT_VALIDATION }
Write-Host ''
Write-Host 'All sibling platforms passed.' -ForegroundColor Green
exit $global:EXIT_OK
