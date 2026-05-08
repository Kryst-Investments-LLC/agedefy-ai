[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$Workflow,
    [switch]$Help
)
. "$PSScriptRoot/../tools/_common.ps1"
if ($Help -or -not $Workflow) {
    Show-HelpAndExit -ScriptName 'v3-workflow-debugger.ps1' `
        -Synopsis 'Step through a workflow YAML and print each agent / action.' `
        -Examples @('./tools-v3/v3-workflow-debugger.ps1 -Workflow biomarker_interpretation_workflow')
}

Assert-PowerShellYaml
$root = Get-PlatformRoot
$file = Join-Path $root "workflows/$Workflow.yml"
if (-not (Test-Path $file)) {
    Write-Error "Workflow not found: $file"
    exit $global:EXIT_VALIDATION
}

$wf = Read-Yaml $file
if (-not $wf) { exit $global:EXIT_SCHEMA }

Write-StepHeader "WORKFLOW: $($wf.name) v$($wf.version)"
Write-Host "Intent:        $($wf.intent)"
Write-Host "Module:        $($wf.feature_module)"
Write-Host "Plan gating:   $($wf.plan_gating -join ', ')"
Write-Host "Legal checks:  $($wf.legal_checks -join ', ')"
Write-Host ''
Write-Host 'Steps:' -ForegroundColor Cyan
$idx = 1
foreach ($s in $wf.steps) {
    Write-Host ('  {0}. [{1}] {2} -> {3}  (timeout {4}ms, on_error: {5})' -f `
        $idx, $s.id, $s.agent, $s.action, ($s.timeout_ms ?? '-'), ($s.on_error ?? 'none'))
    $idx++
}
Write-Host ''
Write-Host "SLA: p50=$($wf.sla.p50_latency_ms)ms p99=$($wf.sla.p99_latency_ms)ms" -ForegroundColor DarkCyan
exit $global:EXIT_OK
