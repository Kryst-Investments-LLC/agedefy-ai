<#
.SYNOPSIS
  Emit Prometheus textfile metrics for the AgeDefy AI platform.

.DESCRIPTION
  Counts agents, workflows, jurisdictions; computes mean rule freshness
  in days; writes ./traces/metrics.prom in Prometheus text format. The
  observability-agent picks this file up.

.PARAMETER OutFile
  Output path (default: ./traces/metrics.prom)

.EXAMPLE
  ./tools-v3/v3-emit-metrics.ps1
#>
[CmdletBinding()]
param(
  [string]$OutFile,
  [switch]$Help
)

. (Join-Path $PSScriptRoot '..\tools\_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }
Assert-PowerShellYaml

$root = Get-PlatformRoot
if (-not $OutFile) { $OutFile = Join-Path $root 'traces\metrics.prom' }
New-Item -ItemType Directory -Force -Path (Split-Path $OutFile) | Out-Null

$agents     = (Get-AgentFiles).Count
$workflows  = (Get-WorkflowFiles).Count
$ruleFiles  = Get-LegalRuleFiles
$ageSum = 0; $ageN = 0; $stale = 0
foreach ($f in $ruleFiles) {
    try {
        $y = Read-Yaml $f.FullName
        if ($y.last_reviewed) {
            $age = ((Get-Date) - [datetime]::Parse($y.last_reviewed)).TotalDays
            $ageSum += $age; $ageN++
            if ($age -gt 365) { $stale++ }
        }
    } catch {}
}
$meanAge = if ($ageN) { [math]::Round($ageSum / $ageN, 1) } else { 0 }

$now = [int][double]::Parse((Get-Date -UFormat %s))
$lines = @(
    "# HELP agedefy_agents_total Total number of agent specs"
    "# TYPE agedefy_agents_total gauge"
    "agedefy_agents_total $agents"
    "# HELP agedefy_workflows_total Total number of workflow specs"
    "# TYPE agedefy_workflows_total gauge"
    "agedefy_workflows_total $workflows"
    "# HELP agedefy_legal_rules_total Total legal-rule files"
    "# TYPE agedefy_legal_rules_total gauge"
    "agedefy_legal_rules_total $($ruleFiles.Count)"
    "# HELP agedefy_legal_rule_age_days_mean Mean days since last_reviewed"
    "# TYPE agedefy_legal_rule_age_days_mean gauge"
    "agedefy_legal_rule_age_days_mean $meanAge"
    "# HELP agedefy_legal_rules_stale Rules older than 365 days"
    "# TYPE agedefy_legal_rules_stale gauge"
    "agedefy_legal_rules_stale $stale"
    "# HELP agedefy_metrics_generated_at Unix timestamp of last emission"
    "# TYPE agedefy_metrics_generated_at gauge"
    "agedefy_metrics_generated_at $now"
)
$lines | Set-Content -Path $OutFile -Encoding UTF8
Write-Host "Wrote metrics to $OutFile" -ForegroundColor Green
exit $EXIT_OK
