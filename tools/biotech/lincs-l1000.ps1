# tools/biotech/lincs-l1000.ps1
# Connectivity Map / LINCS L1000 query wrapper used by
# compound-interaction-agent and target-identification-agent.
# Returns top connectivity hits for a perturbagen by id.

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Perturbagen,
    [string]$CellLine = 'A375',
    [int]$TopN = 25,
    [string]$CachePath = "$env:TEMP/agedefy-lincs-cache.json",
    [switch]$Help
)

. "$PSScriptRoot/../_common.ps1"
if ($Help) {
    Write-Host "Usage: lincs-l1000.ps1 -Perturbagen <broad_id> [-CellLine A375] [-TopN 25]"
    exit $global:EXIT_OK
}

# LINCS L1000 public endpoints rate-limit aggressively; the agent expects a
# nightly sync job to materialize a JSON snapshot. This wrapper reads from it.
if (-not (Test-Path $CachePath)) {
    Write-Error "LINCS cache not found at $CachePath. Populate via the lincs-sync job."
    exit $global:EXIT_MISSING_DEP
}

try {
    $cache = Get-Content $CachePath -Raw | ConvertFrom-Json
    $key = "$Perturbagen|$CellLine"
    $hits = $cache.$key
    if (-not $hits) {
        @{ perturbagen = $Perturbagen; cell_line = $CellLine; hits = @(); cache_hit = $false } | ConvertTo-Json -Depth 5
        exit $global:EXIT_OK
    }
    @{
        perturbagen = $Perturbagen
        cell_line   = $CellLine
        hits        = @($hits | Select-Object -First $TopN)
        cache_hit   = $true
    } | ConvertTo-Json -Depth 5
    exit $global:EXIT_OK
} catch {
    Write-Error "LINCS query failed: $_"
    exit $global:EXIT_RUNTIME
}
