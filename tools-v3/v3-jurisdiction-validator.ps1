[CmdletBinding()]
param([string]$Code, [switch]$Strict, [switch]$Help)
. "$PSScriptRoot/../tools/_common.ps1"
if ($Help) {
    Show-HelpAndExit -ScriptName 'v3-jurisdiction-validator.ps1' `
        -Synopsis 'Validate one or all jurisdiction YAML files (codes, severity-tiered freshness, required keys). Freshness windows tighten with rule severity (critical 90d / high 180d / medium 270d / low 365d). -Strict makes stale files a hard failure (use in the nightly drift job so it escalates); without it staleness is a non-blocking warning.' `
        -Examples @('./tools-v3/v3-jurisdiction-validator.ps1', './tools-v3/v3-jurisdiction-validator.ps1 -Code us', './tools-v3/v3-jurisdiction-validator.ps1 -Strict')
}

Assert-PowerShellYaml
$root  = Get-PlatformRoot
$files = if ($Code) {
    @(Join-Path $root "agents/legal-rules/$Code.yml")
} else {
    Get-LegalRuleFiles
}

$errors      = @()
$warns       = @()
$staleErrors = @()
$now         = Get-Date

# Severity-tiered review windows: the more severe a file's rules, the tighter
# the freshness window. A flat 365-day window is too coarse for critical
# regulatory rules (HIPAA PHI egress, controlled substances) that move fast.
$sevDays = @{ critical = 90; high = 180; medium = 270; low = 365 }
$sevRank = @{ critical = 4; high = 3; medium = 2; low = 1 }

foreach ($f in $files) {
    $path = if ($f -is [IO.FileInfo]) { $f.FullName } else { [string]$f }
    if (-not (Test-Path $path)) { $errors += "$path : file not found"; continue }
    $rel = $path -replace [regex]::Escape($root + [IO.Path]::DirectorySeparatorChar), ''
    try { $y = Read-Yaml $path } catch { $errors += "$rel : invalid YAML"; continue }
    if (-not $y) { $errors += "$rel : invalid YAML"; continue }

    if (-not $y.jurisdiction)            { $errors += "$rel : missing jurisdiction" }
    if (-not $y.jurisdiction.code)       { $errors += "$rel : missing jurisdiction.code" }
    if (-not $y.last_reviewed)           { $errors += "$rel : missing last_reviewed" }
    if (-not $y.rules -or $y.rules.Count -eq 0) { $errors += "$rel : no rules" }

    # Governing severity = the most severe rule in the file; it sets the window.
    $maxSev = 'low'
    foreach ($r in @($y.rules)) {
        $s = [string]$r.severity
        if ($sevRank.ContainsKey($s) -and $sevRank[$s] -gt $sevRank[$maxSev]) { $maxSev = $s }
    }
    $threshold = $sevDays[$maxSev]

    if ($y.last_reviewed) {
        try {
            $lr  = [datetime]::Parse($y.last_reviewed)
            $age = [int]([math]::Floor((($now - $lr).TotalDays)))
            if ($age -gt $threshold) {
                $msg = "$rel : last_reviewed $age days ago exceeds the $threshold-day window for '$maxSev'-severity rules ($($lr.ToShortDateString()))"
                $warns += $msg
                if ($Strict) { $staleErrors += $msg }
            }
        } catch { $errors += "$rel : last_reviewed not parseable" }
    }

    foreach ($r in @($y.rules)) {
        foreach ($k in 'id','description','severity','category','when','then','citations') {
            if (-not $r.$k) { $errors += "$rel : rule missing '$k'" }
        }
        if ($r.severity -and $r.severity -notin 'low','medium','high','critical') {
            $errors += "$rel : rule '$($r.id)' invalid severity '$($r.severity)'"
        }
    }
}

if ($warns)  { Write-Host ''; Write-Host 'WARNINGS:' -ForegroundColor Yellow; $warns | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow } }

$failStale = $Strict -and $staleErrors.Count -gt 0
if ($errors -or $failStale) {
    if ($errors) {
        Write-Host ''; Write-Host 'ERRORS:' -ForegroundColor Red
        $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    }
    if ($failStale) {
        Write-Host ''
        Write-Host "STRICT: $($staleErrors.Count) legal-rule file(s) exceed their severity-tiered review window." -ForegroundColor Red
    }
    exit $global:EXIT_VALIDATION
}
Write-Host ''
Write-Host 'Jurisdiction validation: OK' -ForegroundColor Green
exit $global:EXIT_OK
