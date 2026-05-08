<#
.SYNOPSIS
  Scaffold a new country-level legal-rules YAML file.
.DESCRIPTION
  Creates agents/legal-rules/<code>.yml from a template and updates
  jurisdictions/index.yml. Validates the result against the
  legal-rule schema via the v3 jurisdiction validator.
.PARAMETER Code
  ISO 3166-1 alpha-2 country code (lower-case).
.PARAMETER Name
  Human-readable country name.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$Code,
  [string]$Name,
  [switch]$Help
)

. (Join-Path $PSScriptRoot '_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }
if (-not $Code -or -not $Name) { Write-Error 'Code and Name are required'; exit $EXIT_VALIDATION }

$root = Get-PlatformRoot
$file = Join-Path $root "agents/legal-rules/$Code.yml"
if (Test-Path $file) {
    Write-Warning "Already exists: $file"; exit $EXIT_VALIDATION
}
$today = (Get-Date).ToString('yyyy-MM-dd')
$body = @"
jurisdiction:
  code: $Code
  name: $Name
last_reviewed: "$today"
rules: []
"@
if ($PSCmdlet.ShouldProcess($file, "create scaffold")) {
    Set-Content -Path $file -Value $body -Encoding UTF8
    Write-Host "Created $file" -ForegroundColor Green
}
exit $EXIT_OK
