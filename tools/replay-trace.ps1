[CmdletBinding()]
param([string]$File, [string]$RunId, [switch]$Help)
. "$PSScriptRoot/_common.ps1"
if ($Help -or -not $File) {
    Show-HelpAndExit -ScriptName 'replay-trace.ps1' `
        -Synopsis 'Replay an orchestrator JSONL trace for a given runId.' `
        -Examples @('./tools/replay-trace.ps1 -File ./traces/orchestrator.jsonl -RunId abc123')
}

if (-not (Test-Path $File)) { Write-Error "Not found: $File"; exit $global:EXIT_VALIDATION }

$matched = 0
Get-Content $File | ForEach-Object {
    if (-not $_) { return }
    try {
        $rec = $_ | ConvertFrom-Json
        if (-not $RunId -or $rec.runId -eq $RunId) {
            $matched++
            $ts  = $rec.ts
            $ag  = $rec.agent
            $dec = $rec.decision
            $lat = $rec.latencyMs
            $int = $rec.intent
            Write-Host ("{0}  [{1}] {2}  intent={3}  decision={4}  {5}ms" -f $ts,$rec.runId,$ag,$int,$dec,$lat)
        }
    } catch {
        Write-Warning "Skipping malformed line"
    }
}
Write-Host ''
Write-Host "Replayed $matched record(s)." -ForegroundColor Green
exit $global:EXIT_OK
