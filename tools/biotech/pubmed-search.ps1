# tools/biotech/pubmed-search.ps1
# Thin E-utilities wrapper used by literature-synthesis-agent.
# Returns normalized PubMed records as JSON on stdout.

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Query,
    [int]$RetMax = 50,
    [int]$WindowDays = 30,
    [string]$ApiKey = $env:PUBMED_API_KEY,
    [switch]$Help
)

. "$PSScriptRoot/../_common.ps1"
if ($Help) {
    Write-Host "Usage: pubmed-search.ps1 -Query '<boolean query>' [-RetMax 50] [-WindowDays 30]"
    exit $global:EXIT_OK
}

$base = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
$mindate = (Get-Date).AddDays(-1 * $WindowDays).ToString('yyyy/MM/dd')
$maxdate = (Get-Date).ToString('yyyy/MM/dd')

$searchUrl = "$base/esearch.fcgi?db=pubmed&term=$([uri]::EscapeDataString($Query))&retmode=json&retmax=$RetMax&mindate=$mindate&maxdate=$maxdate&datetype=pdat"
if ($ApiKey) { $searchUrl += "&api_key=$ApiKey" }

try {
    $ids = (Invoke-RestMethod -Uri $searchUrl -Method GET).esearchresult.idlist
    if (-not $ids -or $ids.Count -eq 0) { '[]'; exit $global:EXIT_OK }

    $summaryUrl = "$base/esummary.fcgi?db=pubmed&id=$($ids -join ',')&retmode=json"
    if ($ApiKey) { $summaryUrl += "&api_key=$ApiKey" }
    $summary = Invoke-RestMethod -Uri $summaryUrl -Method GET

    $records = foreach ($id in $ids) {
        $r = $summary.result.$id
        if (-not $r) { continue }
        [pscustomobject]@{
            pmid    = $id
            title   = $r.title
            journal = $r.fulljournalname
            pubdate = $r.pubdate
            authors = @($r.authors | ForEach-Object { $_.name })
            doi     = ($r.elocationid -replace '^doi:\s*', '')
        }
    }
    $records | ConvertTo-Json -Depth 5
    exit $global:EXIT_OK
} catch {
    Write-Error "PubMed query failed: $_"
    exit $global:EXIT_RUNTIME
}
