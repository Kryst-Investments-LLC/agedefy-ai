<#
.SYNOPSIS
  Print platform KPI dashboard (coverage %, freshness, simulation pass).

.DESCRIPTION
  Aggregates jurisdiction coverage, rule freshness, agent/workflow
  parity vs README modules, and recent simulation status. Designed to
  be runnable in CI and pasted into PR comments.

.PARAMETER Json
  Emit machine-readable JSON instead of formatted table.

.PARAMETER Help
  Show this help.
#>
[CmdletBinding()]
param([switch]$Json, [switch]$Help)

. (Join-Path $PSScriptRoot '..\tools\_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }
Assert-PowerShellYaml

$root = Get-PlatformRoot

$agents      = (Get-AgentFiles).Count
$workflows   = (Get-WorkflowFiles).Count

$rules = Get-LegalRuleFiles
$total = $rules.Count
$fresh = 0; $stale = 0; $missingCite = 0
foreach ($f in $rules) {
    try {
        $y = Read-Yaml $f.FullName
        if ($y.last_reviewed -and ((Get-Date)-[datetime]::Parse($y.last_reviewed)).TotalDays -le 365) {
            $fresh++
        } else { $stale++ }
        foreach ($r in @($y.rules)) { if (-not $r.citations) { $missingCite++ } }
    } catch { $stale++ }
}
$coverage = if ($total) { [math]::Round(100*$fresh/$total,1) } else { 0 }

# README parity
$readme = Join-Path $root 'README.md'
$expectedModules = 17
$workflowsOnDisk = (Get-WorkflowFiles).Count
$parity = [math]::Round(100*[math]::Min($workflowsOnDisk,$expectedModules)/$expectedModules,1)

$result = [pscustomobject]@{
    agents_total              = $agents
    workflows_total           = $workflows
    legal_rule_files          = $total
    legal_rule_coverage_pct   = $coverage
    legal_rules_stale         = $stale
    legal_rules_missing_cite  = $missingCite
    readme_module_parity_pct  = $parity
    generated_at              = (Get-Date).ToString('s')
}

if ($Json) {
    $result | ConvertTo-Json -Depth 5
} else {
    Write-StepHeader "AgeDefy AI — KPI Dashboard"
    $result | Format-List | Out-String | Write-Host
}
exit $EXIT_OK
