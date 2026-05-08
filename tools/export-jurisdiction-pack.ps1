<#
.SYNOPSIS
  Export a self-contained jurisdiction pack (rules + matching workflows + agent).
.DESCRIPTION
  Bundles agents/legal-rules/<code>.yml + every workflow that references the
  jurisdiction + the law-awareness-agent into a zip under ./dist/.
.PARAMETER Code
  Jurisdiction code (e.g. us, eu, us-ca).
#>
[CmdletBinding()]
param(
  [string]$Code,
  [switch]$Help
)

. (Join-Path $PSScriptRoot '_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }
if (-not $Code) { Write-Error '-Code is required'; exit $EXIT_VALIDATION }

$root = Get-PlatformRoot
$ruleFile = Join-Path $root "agents/legal-rules/$Code.yml"
if (-not (Test-Path $ruleFile)) { $ruleFile = Join-Path $root "agents/legal-rules/us-states/$($Code -replace '^us-','').yml" }
if (-not (Test-Path $ruleFile)) { Write-Error "No rules for $Code"; exit $EXIT_VALIDATION }

$staging = Join-Path $root "dist/pack-$Code"
$null = New-Item -ItemType Directory -Force -Path $staging
Copy-Item $ruleFile (Join-Path $staging 'legal-rules.yml') -Force
Copy-Item (Join-Path $root 'agents/law-awareness-agent.yml') $staging -Force
Copy-Item (Join-Path $root 'workflows') -Destination $staging -Recurse -Force

$zip = Join-Path $root "dist/jurisdiction-pack-$Code.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$staging/*" -DestinationPath $zip -Force
Write-Host "Wrote $zip" -ForegroundColor Green
exit $EXIT_OK
