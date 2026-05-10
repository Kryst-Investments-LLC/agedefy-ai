# tools/biotech/depmap-fetch.ps1
# DepMap public-release essentiality fetcher used by target-identification-agent.
# Pulls a cached CSV slice via the DepMap public download API and prints
# {gene, mean_dependency, n_essential_lines} for the requested gene.

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Gene,
    [string]$Release = 'public_24q2',
    [string]$CachePath = "$env:TEMP/agedefy-depmap-cache.json",
    [switch]$Help
)

. "$PSScriptRoot/../_common.ps1"
if ($Help) {
    Write-Host "Usage: depmap-fetch.ps1 -Gene <symbol> [-Release public_24q2]"
    exit $global:EXIT_OK
}

# This wrapper expects an external sync job to populate $CachePath as
# { "<gene>": { "mean_dependency": <float>, "n_essential_lines": <int> } }
# kept as JSON so the agent stays deterministic offline.
if (-not (Test-Path $CachePath)) {
    Write-Error "DepMap cache not found at $CachePath. Populate via the depmap-sync job."
    exit $global:EXIT_MISSING_DEP
}

try {
    $cache = Get-Content $CachePath -Raw | ConvertFrom-Json
    $entry = $cache.$Gene
    if (-not $entry) {
        @{ gene = $Gene; mean_dependency = $null; n_essential_lines = 0; release = $Release; cache_hit = $false } | ConvertTo-Json
        exit $global:EXIT_OK
    }
    @{
        gene              = $Gene
        mean_dependency   = $entry.mean_dependency
        n_essential_lines = $entry.n_essential_lines
        release           = $Release
        cache_hit         = $true
    } | ConvertTo-Json
    exit $global:EXIT_OK
} catch {
    Write-Error "DepMap fetch failed: $_"
    exit $global:EXIT_RUNTIME
}
