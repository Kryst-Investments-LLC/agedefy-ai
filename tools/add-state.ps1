<#
.SYNOPSIS
  Scaffold a new US state legal-rules file under agents/legal-rules/us-states/.
.PARAMETER State
  Lower-case 2-letter state code (e.g. ca, ny, tx, fl).
.PARAMETER Name
  Human-readable state name.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$State,
  [string]$Name,
  [switch]$Help
)

. (Join-Path $PSScriptRoot '_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }
if (-not $State -or -not $Name) { Write-Error 'State and Name are required'; exit $EXIT_VALIDATION }

$root = Get-PlatformRoot
$dir  = Join-Path $root 'agents/legal-rules/us-states'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$file = Join-Path $dir "$State.yml"
if (Test-Path $file) { Write-Warning "Already exists: $file"; exit $EXIT_VALIDATION }
$today = (Get-Date).ToString('yyyy-MM-dd')
$body = @"
jurisdiction:
  code: us-$State
  name: "United States — $Name"
last_reviewed: "$today"
rules: []
"@
if ($PSCmdlet.ShouldProcess($file, "create scaffold")) {
    Set-Content -Path $file -Value $body -Encoding UTF8
    Write-Host "Created $file" -ForegroundColor Green
}
exit $EXIT_OK
