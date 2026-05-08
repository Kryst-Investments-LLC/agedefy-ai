<#
.SYNOPSIS
  Search legal rules by keyword across all jurisdictions.
.PARAMETER Pattern
  Regex pattern matched against rule id / description / category.
#>
[CmdletBinding()]
param(
  [string]$Pattern,
  [switch]$Help
)

. (Join-Path $PSScriptRoot '_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }
Assert-PowerShellYaml
if (-not $Pattern) { Write-Error '-Pattern is required'; exit $EXIT_VALIDATION }

$rx = [regex]::new($Pattern, 'IgnoreCase')
$hits = foreach ($f in Get-LegalRuleFiles) {
    try { $y = Read-Yaml $f.FullName } catch { continue }
    foreach ($r in @($y.rules)) {
        $hay = "$($r.id) $($r.description) $($r.category)"
        if ($rx.IsMatch($hay)) {
            [pscustomobject]@{
                jurisdiction = $y.jurisdiction.code
                id           = $r.id
                severity     = $r.severity
                description  = $r.description
            }
        }
    }
}
if (-not $hits) { Write-Host "No matches for /$Pattern/" -ForegroundColor Yellow; exit $EXIT_OK }
$hits | Format-Table -AutoSize | Out-String | Write-Host
exit $EXIT_OK
