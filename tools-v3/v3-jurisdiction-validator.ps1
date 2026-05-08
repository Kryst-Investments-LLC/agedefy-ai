[CmdletBinding()]
param([string]$Code, [switch]$Help)
. "$PSScriptRoot/../tools/_common.ps1"
if ($Help) {
    Show-HelpAndExit -ScriptName 'v3-jurisdiction-validator.ps1' `
        -Synopsis 'Validate one or all jurisdiction YAML files (codes, freshness, required keys).' `
        -Examples @('./tools-v3/v3-jurisdiction-validator.ps1', './tools-v3/v3-jurisdiction-validator.ps1 -Code us')
}

Assert-PowerShellYaml
$root  = Get-PlatformRoot
$files = if ($Code) {
    @(Join-Path $root "agents/legal-rules/$Code.yml")
} else {
    Get-LegalRuleFiles
}

$errors = @()
$warns  = @()
$now    = Get-Date

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

    if ($y.last_reviewed) {
        try {
            $lr = [datetime]::Parse($y.last_reviewed)
            if (($now - $lr).TotalDays -gt 365) {
                $warns += "$rel : last_reviewed > 365 days ago ($($lr.ToShortDateString()))"
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
if ($errors) {
    Write-Host ''; Write-Host 'ERRORS:' -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit $global:EXIT_VALIDATION
}
Write-Host ''
Write-Host 'Jurisdiction validation: OK' -ForegroundColor Green
exit $global:EXIT_OK
