# tools/biotech/alphafold-predict.ps1
# AlphaFold 3 / EBI AlphaFold DB wrapper used by target-identification-agent.
# For known UniProt accessions it returns the cached AlphaFold DB structure URL.
# For novel sequences it stubs out an AlphaFold 3 server-side prediction request.

[CmdletBinding()]
param(
    [string]$UniProt,
    [string]$SequenceFasta,
    [string]$ApiKey = $env:ALPHAFOLD3_API_KEY,
    [switch]$Help
)

. "$PSScriptRoot/../_common.ps1"
if ($Help) {
    Write-Host "Usage: alphafold-predict.ps1 -UniProt <accession>"
    Write-Host "       alphafold-predict.ps1 -SequenceFasta <path>"
    exit $global:EXIT_OK
}

if (-not $UniProt -and -not $SequenceFasta) {
    Write-Error "Provide -UniProt or -SequenceFasta."
    exit $global:EXIT_VALIDATION
}

if ($UniProt) {
    $url = "https://alphafold.ebi.ac.uk/api/prediction/$UniProt"
    try {
        $resp = Invoke-RestMethod -Uri $url -Method GET
        if (-not $resp) {
            @{ uniprot = $UniProt; status = 'not_found' } | ConvertTo-Json
            exit $global:EXIT_OK
        }
        @{
            uniprot       = $UniProt
            pdb_url       = $resp[0].pdbUrl
            cif_url       = $resp[0].cifUrl
            confidence    = $resp[0].globalMetricValue
            model_version = $resp[0].latestVersion
        } | ConvertTo-Json
        exit $global:EXIT_OK
    } catch {
        Write-Error "AlphaFold DB lookup failed: $_"
        exit $global:EXIT_RUNTIME
    }
}

# Novel-sequence path is a documented stub. AlphaFold 3 server inference
# requires DeepMind / EBI access; the agent should call a sidecar service
# rather than hit a public endpoint. This block emits the request envelope
# the agent expects so unit tests can assert the shape.
if (-not $ApiKey) {
    Write-Error "ALPHAFOLD3_API_KEY not set; cannot run novel-sequence prediction."
    exit $global:EXIT_MISSING_DEP
}

@{
    status   = 'request_envelope_only'
    fasta    = $SequenceFasta
    api_key  = $ApiKey.Substring(0, [Math]::Min(4, $ApiKey.Length)) + '****'
    note     = 'Send to internal AlphaFold 3 sidecar; this CLI does not hit external compute.'
} | ConvertTo-Json
exit $global:EXIT_OK
