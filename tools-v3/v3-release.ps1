<#
.SYNOPSIS
  AgeDefy AI Platform — release driver.

.DESCRIPTION
  Bumps version.json (semver), writes CHANGELOG entry stub, creates a
  signed annotated git tag (`vX.Y.Z`), and prints the next steps for
  pushing the tag (which triggers .github/workflows/release.yml to
  build SBOM + cosign signature).

.PARAMETER Bump
  major | minor | patch (default: patch)

.PARAMETER Channel
  dev | beta | stable (default: stable)

.PARAMETER WhatIf
  Show what would happen without modifying files.

.EXAMPLE
  ./tools-v3/v3-release.ps1 -Bump minor -Channel stable
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [ValidateSet('major','minor','patch')] [string]$Bump = 'patch',
  [ValidateSet('dev','beta','stable')]   [string]$Channel = 'stable',
  [switch]$Help
)

. (Join-Path $PSScriptRoot '..\tools\_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }

$root = Get-PlatformRoot
$versionFile = Join-Path $root 'version.json'
if (-not (Test-Path $versionFile)) {
    Write-Error "version.json missing at $versionFile"; exit $EXIT_RUNTIME
}

$v = Get-Content $versionFile -Raw | ConvertFrom-Json
$current = $v.version
if ($current -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
    Write-Error "version.json has malformed semver: $current"; exit $EXIT_VALIDATION
}
$maj=[int]$Matches[1]; $min=[int]$Matches[2]; $pat=[int]$Matches[3]
switch ($Bump) {
    'major' { $maj++; $min=0; $pat=0 }
    'minor' { $min++; $pat=0 }
    'patch' { $pat++ }
}
$next = "$maj.$min.$pat"

Write-StepHeader "Release: $current  ->  $next  (channel=$Channel)"

if ($PSCmdlet.ShouldProcess($versionFile, "bump version to $next")) {
    $v.version        = $next
    $v.releaseChannel = $Channel
    ($v | ConvertTo-Json -Depth 5) | Set-Content -Path $versionFile -Encoding UTF8
}

# Append CHANGELOG entry stub
$cl = Join-Path $root 'CHANGELOG.md'
if (Test-Path $cl) {
    $entry = "`n## [$next] - $((Get-Date).ToString('yyyy-MM-dd'))`n- Release on channel **$Channel**.`n"
    if ($PSCmdlet.ShouldProcess($cl, "prepend entry $next")) {
        $body = Get-Content $cl -Raw
        Set-Content -Path $cl -Value ($entry + $body) -Encoding UTF8
    }
}

# Create signed annotated tag
$tag = "v$next"
if ($PSCmdlet.ShouldProcess($tag, "git tag -s")) {
    git tag -s $tag -m "AgeDefy AI Platform $tag ($Channel)"
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Signed tag failed (no GPG?). Falling back to unsigned annotated tag."
        git tag -a $tag -m "AgeDefy AI Platform $tag ($Channel)"
    }
}

Write-Host ""
Write-Host "Next: git push origin main --follow-tags" -ForegroundColor Green
exit $EXIT_OK
