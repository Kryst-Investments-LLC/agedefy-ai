<#
.SYNOPSIS
  Print a one-screen jurisdiction dashboard: counts, freshness, severity mix.
#>
[CmdletBinding()]
param([switch]$Help, [switch]$Json)

. (Join-Path $PSScriptRoot '_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }
Assert-PowerShellYaml

$root  = Get-PlatformRoot
$files = Get-LegalRuleFiles
$rows = foreach ($f in $files) {
    try {
        $y = Read-Yaml $f.FullName
    } catch { continue }
    $ageDays = if ($y.last_reviewed) {
        [int]((Get-Date) - [datetime]::Parse($y.last_reviewed)).TotalDays
    } else { -1 }
    $sev = @{}
    foreach ($r in @($y.rules)) {
        if ($r.severity) { $sev[$r.severity] = (1 + [int]($sev[$r.severity])) }
    }
    [pscustomobject]@{
        code      = $y.jurisdiction.code
        rules     = @($y.rules).Count
        critical  = [int]$sev['critical']
        high      = [int]$sev['high']
        ageDays   = $ageDays
        stale     = ($ageDays -gt 365)
    }
}
if ($Json) { $rows | ConvertTo-Json -Depth 4 } else { $rows | Format-Table -AutoSize | Out-String | Write-Host }
exit $EXIT_OK
