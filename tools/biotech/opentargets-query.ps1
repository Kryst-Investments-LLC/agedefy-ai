# tools/biotech/opentargets-query.ps1
# OpenTargets GraphQL wrapper used by target-identification-agent.
# Returns target druggability + tractability JSON on stdout.

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Gene,
    [string]$Disease,
    [switch]$Help
)

. "$PSScriptRoot/../_common.ps1"
if ($Help) {
    Write-Host "Usage: opentargets-query.ps1 -Gene <symbol|ensembl> [-Disease <EFO/MONDO id>]"
    exit $global:EXIT_OK
}

$endpoint = 'https://api.platform.opentargets.org/api/v4/graphql'

$query = @'
query TargetInfo($gene: String!) {
  target(ensemblId: $gene) {
    id
    approvedSymbol
    approvedName
    biotype
    tractability { label modality value }
    safetyLiabilities { event eventId datasource }
  }
}
'@

$body = @{ query = $query; variables = @{ gene = $Gene } } | ConvertTo-Json -Depth 4 -Compress

try {
    $resp = Invoke-RestMethod -Uri $endpoint -Method POST -ContentType 'application/json' -Body $body
    if ($resp.errors) {
        Write-Error ("OpenTargets returned errors: " + ($resp.errors | ConvertTo-Json -Compress))
        exit $global:EXIT_RUNTIME
    }
    $resp.data | ConvertTo-Json -Depth 8
    exit $global:EXIT_OK
} catch {
    Write-Error "OpenTargets query failed: $_"
    exit $global:EXIT_RUNTIME
}
