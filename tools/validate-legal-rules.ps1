<#
.SYNOPSIS
  Validate every legal-rules YAML file against schemas/legal-rule.schema.json
  (structural) and jurisdiction-validator (semantic + freshness).
#>
[CmdletBinding()]
param([switch]$Help)

. (Join-Path $PSScriptRoot '_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }
Assert-PowerShellYaml

$root  = Get-PlatformRoot
$files = Get-LegalRuleFiles
$bad = 0
foreach ($f in $files) {
    try {
        $y = Read-Yaml $f.FullName
    } catch {
        Write-Host "FAIL parse: $($f.FullName)" -ForegroundColor Red; $bad++; continue
    }
    $missing = @()
    if (-not $y.jurisdiction.code) { $missing += 'jurisdiction.code' }
    if (-not $y.last_reviewed)     { $missing += 'last_reviewed' }
    foreach ($r in @($y.rules)) {
        if (-not $r.id)          { $missing += "rule.id ($($f.Name))" }
        if (-not $r.severity)    { $missing += "rule.severity ($($r.id))" }
        if (-not $r.citations)   { $missing += "rule.citations ($($r.id))" }
    }
    if ($missing) {
        Write-Host "FAIL $($f.Name): $(($missing | Select-Object -Unique) -join ', ')" -ForegroundColor Red
        $bad++
    } else {
        Write-Host "OK   $($f.Name)" -ForegroundColor Green
    }
}
if ($bad) { exit $EXIT_VALIDATION } else { exit $EXIT_OK }
