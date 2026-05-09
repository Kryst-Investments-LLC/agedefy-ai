<#
.SYNOPSIS
  Eval feedback loop — closes the L5 optimizing cycle.

.DESCRIPTION
  1. Runs the eval + red-team Pester suites and writes NUnit XML.
  2. Computes per-agent pass-rate from test names.
  3. Loads the previous baseline (./traces/eval-baseline.json).
  4. Decides per agent:
       - regression  (>= 5pp drop)         -> queue auto-rollback PR
       - improvement (>= 1 new case green) -> queue patch version bump
  5. Emits Prometheus metrics and an OTLP log line per agent.
  6. Writes the new baseline.
  7. If $env:GITHUB_ACTIONS == 'true' AND any decisions, opens a PR via gh.

.PARAMETER DryRun
  Skip PR creation, just print the plan.

.PARAMETER ResultsDir
  Where to write/read NUnit XML (default ./traces/eval).

.EXAMPLE
  ./tools-v3/v3-eval-feedback.ps1 -DryRun
#>
[CmdletBinding()]
param(
    [string] $ResultsDir,
    [string] $BaselinePath,
    [switch] $DryRun,
    [switch] $Help
)

. (Join-Path $PSScriptRoot '..\tools\_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }
Assert-PowerShellYaml

$root = Get-PlatformRoot
if (-not $ResultsDir)   { $ResultsDir   = Join-Path $root 'traces\eval' }
if (-not $BaselinePath) { $BaselinePath = Join-Path $root 'traces\eval-baseline.json' }
New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

$cfg = (Get-Content (Join-Path $root 'agents\eval-feedback-agent.yml') -Raw | ConvertFrom-Yaml).config

# -------------------------------------------------------------------- #
# 1. Run eval + redteam                                                #
# -------------------------------------------------------------------- #

Write-Host '[1/6] Running eval + red-team suites...' -ForegroundColor Cyan
$evalXml    = Join-Path $ResultsDir 'eval-results.xml'
$redteamXml = Join-Path $ResultsDir 'redteam-results.xml'

$null = Invoke-Pester -Path (Join-Path $root 'tests\eval')    -OutputFile $evalXml    -OutputFormat NUnitXml -PassThru -Show None
$null = Invoke-Pester -Path (Join-Path $root 'tests\redteam') -OutputFile $redteamXml -OutputFormat NUnitXml -PassThru -Show None

# -------------------------------------------------------------------- #
# 2. Score per agent                                                   #
# -------------------------------------------------------------------- #

Write-Host '[2/6] Scoring per agent...' -ForegroundColor Cyan

function Get-AgentPassRates {
    param([Parameter(Mandatory)][string]$XmlPath)
    if (-not (Test-Path $XmlPath)) { return @{} }
    [xml]$x = Get-Content -Raw $XmlPath
    $cases = @($x.SelectNodes('//test-case'))
    $byAgent = @{}
    foreach ($c in $cases) {
        # Convention: test names embed the agent name, e.g.
        #   "law-awareness-agent: jurisdiction US blocks supplement claim"
        $name = $c.name
        $agent = if ($name -match '([a-z][a-z0-9-]*-agent)') { $matches[1] } else { 'unknown' }
        $ok    = $c.result -eq 'Success' -or $c.result -eq 'Passed'
        if (-not $byAgent.ContainsKey($agent)) {
            $byAgent[$agent] = [pscustomobject]@{ pass = 0; total = 0 }
        }
        $byAgent[$agent].total++
        if ($ok) { $byAgent[$agent].pass++ }
    }
    $rates = @{}
    foreach ($k in $byAgent.Keys) {
        $rates[$k] = [math]::Round($byAgent[$k].pass / [math]::Max(1, $byAgent[$k].total), 4)
    }
    return $rates
}

$current = @{}
foreach ($r in (Get-AgentPassRates -XmlPath $evalXml).GetEnumerator())    { $current[$r.Key] = $r.Value }
foreach ($r in (Get-AgentPassRates -XmlPath $redteamXml).GetEnumerator()) {
    if ($current.ContainsKey($r.Key)) { $current[$r.Key] = [math]::Round(($current[$r.Key] + $r.Value)/2, 4) }
    else                              { $current[$r.Key] = $r.Value }
}

# -------------------------------------------------------------------- #
# 3. Compare to baseline                                               #
# -------------------------------------------------------------------- #

Write-Host '[3/6] Loading baseline + computing deltas...' -ForegroundColor Cyan

$baseline = if (Test-Path $BaselinePath) {
    Get-Content $BaselinePath -Raw | ConvertFrom-Json -AsHashtable
} else {
    Write-Host '    (no baseline found, treating current as baseline)' -ForegroundColor Yellow
    @{}
}

$decisions = @()
foreach ($agent in $current.Keys) {
    $now    = $current[$agent]
    $before = if ($baseline.ContainsKey($agent)) { [double]$baseline[$agent] } else { $null }
    $delta  = if ($before -ne $null) { [math]::Round($now - $before, 4) } else { 0 }

    $decision = 'noop'
    if ($before -ne $null -and $delta -le -[double]$cfg.regression_threshold) { $decision = 'rollback' }
    elseif ($now -lt [double]$cfg.sla_min_pass_rate)                          { $decision = 'sla_breach' }
    elseif ($delta -gt 0 -and $cfg.auto_bump_patch)                           { $decision = 'bump_patch' }

    $decisions += [pscustomobject]@{
        agent    = $agent
        baseline = $before
        current  = $now
        delta    = $delta
        decision = $decision
    }
}

$decisions | Format-Table -AutoSize

# -------------------------------------------------------------------- #
# 4. Emit metrics + OTLP                                               #
# -------------------------------------------------------------------- #

Write-Host '[4/6] Emitting metrics...' -ForegroundColor Cyan

$promFile = Join-Path $root 'traces\eval-pass-rate.prom'
$promLines = @(
    '# HELP agedefy_eval_pass_rate Per-agent eval+redteam pass rate'
    '# TYPE agedefy_eval_pass_rate gauge'
)
foreach ($d in $decisions) {
    $promLines += "agedefy_eval_pass_rate{agent=`"$($d.agent)`",decision=`"$($d.decision)`"} $($d.current)"
}
$promLines | Set-Content -Path $promFile -Encoding UTF8

# Emit one JSONL trace line per decision for the OTLP exporter to pick up.
$traceFile = Join-Path $root 'traces\orchestrator.jsonl'
foreach ($d in $decisions) {
    $rec = @{
        runId     = (New-Guid).ToString()
        ts        = (Get-Date).ToUniversalTime().ToString('o')
        agent     = 'eval-feedback-agent'
        intent    = 'eval.feedback_loop'
        decision  = if ($d.decision -in 'rollback','sla_breach') { 'block' }
                    elseif ($d.decision -eq 'bump_patch')         { 'allow' }
                    else                                          { 'ok' }
        latencyMs = 0
        target_agent = $d.agent
        baseline  = $d.baseline
        current   = $d.current
        delta     = $d.delta
    }
    ($rec | ConvertTo-Json -Compress) | Add-Content -Path $traceFile
}

# -------------------------------------------------------------------- #
# 5. Bump versions / queue rollbacks                                   #
# -------------------------------------------------------------------- #

Write-Host '[5/6] Updating agent specs...' -ForegroundColor Cyan

$prBody = @(
    '## Eval feedback loop — automated agent updates'
    ''
    '| Agent | Baseline | Current | Delta | Action |'
    '|---|---|---|---|---|'
)
$anyChange = $false

foreach ($d in $decisions) {
    if ($d.decision -in @('noop','sla_breach')) {
        $prBody += "| $($d.agent) | $($d.baseline) | $($d.current) | $($d.delta) | $($d.decision) |"
        continue
    }

    $specPath = Join-Path $root "agents\$($d.agent).yml"
    if (-not (Test-Path $specPath)) {
        Write-Host "  ?? skip $($d.agent) (no spec at $specPath)" -ForegroundColor Yellow
        continue
    }

    $raw = Get-Content $specPath -Raw
    if ($raw -notmatch 'version:\s*([0-9]+)\.([0-9]+)\.([0-9]+)') { continue }
    $maj = [int]$matches[1]; $min = [int]$matches[2]; $pat = [int]$matches[3]

    switch ($d.decision) {
        'bump_patch' { $pat++ }
        'rollback'   { if ($pat -gt 0) { $pat-- } else { $min = [math]::Max(0,$min-1) } }
    }
    $newVer = "$maj.$min.$pat"
    $newRaw = $raw -replace '(?m)^version:\s*[0-9]+\.[0-9]+\.[0-9]+', "version: $newVer"
    if ($newRaw -ne $raw) {
        Set-Content -Path $specPath -Value $newRaw -Encoding UTF8 -NoNewline
        $anyChange = $true
        $prBody += "| $($d.agent) | $($d.baseline) | $($d.current) | $($d.delta) | $($d.decision) -> v$newVer |"
    }
}

# -------------------------------------------------------------------- #
# 6. Persist baseline + open PR                                        #
# -------------------------------------------------------------------- #

Write-Host '[6/6] Persisting baseline...' -ForegroundColor Cyan
$current | ConvertTo-Json -Depth 4 | Set-Content -Path $BaselinePath -Encoding UTF8

if ($DryRun) {
    Write-Host ''
    Write-Host '== DRY RUN =='
    $prBody | ForEach-Object { Write-Host $_ }
    exit $EXIT_OK
}

if ($anyChange -and $env:GITHUB_ACTIONS -eq 'true') {
    $branch = "auto/eval-feedback-$(Get-Date -Format 'yyyyMMdd-HHmm')"
    git checkout -b $branch | Out-Null
    git add agents/ traces/eval-baseline.json | Out-Null
    git -c user.email='eval-feedback@agedefy.ai' -c user.name='eval-feedback-bot' commit -m "chore(eval): auto agent version bumps from feedback loop" | Out-Null
    git push origin $branch | Out-Null
    $body = ($prBody -join "`n")
    gh pr create --base main --head $branch --title 'chore(eval): automated agent version bumps' --body $body | Out-Null
    Write-Host "[+] PR opened on $branch" -ForegroundColor Green
}

exit $EXIT_OK
