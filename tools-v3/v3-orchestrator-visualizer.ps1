[CmdletBinding(SupportsShouldProcess)]
param([switch]$Help, [string]$OutFile)
. "$PSScriptRoot/../tools/_common.ps1"
if ($Help) {
    Show-HelpAndExit -ScriptName 'v3-orchestrator-visualizer.ps1' `
        -Synopsis 'Render the orchestrator -> agent graph as Mermaid.' `
        -Examples @('./tools-v3/v3-orchestrator-visualizer.ps1', './tools-v3/v3-orchestrator-visualizer.ps1 -OutFile graph.md')
}

Assert-PowerShellYaml
$root = Get-PlatformRoot
$orch = Read-Yaml (Join-Path $root 'agents/master-orchestrator-agent.yml')
if (-not $orch) { exit $global:EXIT_SCHEMA }

$lines = @()
$lines += '```mermaid'
$lines += 'graph TD'
$lines += '  ENTRY[entry-agent] --> ORCH[master-orchestrator-agent]'
foreach ($r in $orch.route)      { $lines += "  ORCH --> $r" }
foreach ($s in $orch.sub_agents) { $lines += "  ORCH -.-> $($s.name)" }
$lines += '```'

if ($OutFile) {
    if ($PSCmdlet.ShouldProcess($OutFile, 'write Mermaid graph')) {
        $lines | Set-Content $OutFile -Encoding UTF8
        Write-Host "Wrote $OutFile" -ForegroundColor Green
    }
} else {
    $lines | ForEach-Object { Write-Host $_ }
}
exit $global:EXIT_OK
