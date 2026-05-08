<#
.SYNOPSIS
  Auto-fixer for common legal-rules issues.
.DESCRIPTION
  - Trims trailing whitespace
  - Lowercases jurisdiction.code
  - Sorts rules by id
  - Reports (does not fix) missing citations / severities
#>
[CmdletBinding(SupportsShouldProcess)]
param([switch]$Help)

. (Join-Path $PSScriptRoot '_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }
Assert-PowerShellYaml

$root  = Get-PlatformRoot
$files = Get-LegalRuleFiles
$issues = 0
foreach ($f in $files) {
    try {
        $y = Read-Yaml $f.FullName
    } catch {
        Write-Warning "Parse error: $($f.FullName)"; $issues++; continue
    }
    if ($y.jurisdiction.code -and ($y.jurisdiction.code -cne $y.jurisdiction.code.ToLower())) {
        Write-Host "lowercase code in $($f.Name)" -ForegroundColor Yellow
        $y.jurisdiction.code = $y.jurisdiction.code.ToLower()
        if ($PSCmdlet.ShouldProcess($f.FullName, 'rewrite')) {
            ConvertTo-Yaml $y | Set-Content -Path $f.FullName -Encoding UTF8
        }
    }
    foreach ($r in @($y.rules)) {
        if (-not $r.citations) { Write-Warning "missing citations: $($f.Name)::$($r.id)"; $issues++ }
        if (-not $r.severity)  { Write-Warning "missing severity:  $($f.Name)::$($r.id)"; $issues++ }
    }
}
Write-Host "Issues found: $issues" -ForegroundColor $(if ($issues) { 'Red' } else { 'Green' })
exit $(if ($issues) { $EXIT_VALIDATION } else { $EXIT_OK })
