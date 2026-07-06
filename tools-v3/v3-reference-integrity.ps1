[CmdletBinding()]
param([switch]$Help)
. "$PSScriptRoot/../tools/_common.ps1"
if ($Help) {
    Show-HelpAndExit -ScriptName 'v3-reference-integrity.ps1' `
        -Synopsis 'Validate cross-references between workflows, agents, metadata and schema files. Catches dangling links that per-file schema validation cannot see (a step pointing at a non-existent agent, a compound citing an unknown pathway, a schema_ref with no file).' `
        -Examples @('./tools-v3/v3-reference-integrity.ps1')
}

Assert-PowerShellYaml
$root = Get-PlatformRoot
$sep  = [IO.Path]::DirectorySeparatorChar
function Get-RelPath([string]$p) { $p -replace [regex]::Escape($root + $sep), '' }

# StrictMode-safe field read: parsed YAML may be a dict, a list, or a scalar.
function Get-Field($obj, [string]$key) {
    if ($obj -is [System.Collections.IDictionary] -and $obj.Contains($key)) { return $obj[$key] }
    return $null
}

$errors = @()
$warns  = @()

# ---------------------------------------------------------------------------
# 1. Known agent names — the `name:` of every agents/**/*.yml (not just *-agent).
# ---------------------------------------------------------------------------
$agentNames = @{}
Get-ChildItem (Join-Path $root 'agents') -Recurse -Filter '*.yml' -File | ForEach-Object {
    $name = Get-Field (Read-Yaml $_.FullName) 'name'
    if ($name) { $agentNames[[string]$name] = $true }
}

# ---------------------------------------------------------------------------
# 2. Every workflow step must bind to a known agent (HARD).
# ---------------------------------------------------------------------------
foreach ($wf in Get-WorkflowFiles) {
    $y = Read-Yaml $wf.FullName
    $rel = Get-RelPath $wf.FullName
    if (-not $y) { $errors += "$rel : invalid YAML"; continue }
    foreach ($s in @(Get-Field $y 'steps')) {
        $agent = Get-Field $s 'agent'
        if ($agent -and -not $agentNames.ContainsKey([string]$agent)) {
            $errors += "$rel : step '$(Get-Field $s 'id')' references unknown agent '$agent'"
        }
    }
}

# ---------------------------------------------------------------------------
# 3. Orchestrator route / sub_agents / routing_rules must name known agents (HARD).
# ---------------------------------------------------------------------------
$orchPath = Join-Path $root 'agents/master-orchestrator-agent.yml'
$orch = Read-Yaml $orchPath
if ($orch) {
    $orel = Get-RelPath $orchPath
    foreach ($a in @(Get-Field $orch 'route')) {
        if ($a -and -not $agentNames.ContainsKey([string]$a)) {
            $errors += "$orel : route references unknown agent '$a'"
        }
    }
    foreach ($sa in @(Get-Field $orch 'sub_agents')) {
        $n = Get-Field $sa 'name'
        if ($n -and -not $agentNames.ContainsKey([string]$n)) {
            $errors += "$orel : sub_agents references unknown agent '$n'"
        }
    }
    foreach ($rule in @(Get-Field $orch 'routing_rules')) {
        $rt = Get-Field $rule 'route_to'
        if ($rt -and -not $agentNames.ContainsKey([string]$rt)) {
            $errors += "$orel : routing_rules route_to unknown agent '$rt'"
        }
    }
}

# ---------------------------------------------------------------------------
# 4. Compound → pathway ids must exist in the pathway vocabulary (HARD).
# ---------------------------------------------------------------------------
$pwIds = @{}
foreach ($p in @(Get-Field (Read-Yaml (Join-Path $root 'metadata/pathways.yml')) 'pathways')) {
    $id = Get-Field $p 'id'
    if ($id) { $pwIds[[string]$id] = $true }
}
foreach ($c in @(Get-Field (Read-Yaml (Join-Path $root 'metadata/compounds.yml')) 'compounds')) {
    $cid = Get-Field $c 'id'
    foreach ($pwref in @(Get-Field $c 'pathways')) {
        if ($pwref -and -not $pwIds.ContainsKey([string]$pwref)) {
            $errors += "metadata/compounds.yml : compound '$cid' references unknown pathway '$pwref'"
        }
    }
}

# ---------------------------------------------------------------------------
# 5. schema_ref / schema file references must resolve on disk.
#
#    Load-bearing CONTRACT schemas (the registry below) are HARD: these back
#    safety/compliance-critical handoffs and must never regress to a stub.
#    Every other discovered schema_ref is a SOFT tracked warning — visible
#    backlog without blocking. Move a ref into the registry as its schema is
#    authored.
# ---------------------------------------------------------------------------
$requiredSchemas = @(
    'schemas/clinician-handoff.v1.json',   # agents/clinician-review-agent.yml structured_handoff
    'schemas/clinician-decision.v1.json'   # agents/clinician-review-agent.yml return_payload
)
foreach ($req in $requiredSchemas) {
    if (-not (Test-Path (Join-Path $root $req))) {
        $errors += "required contract schema '$req' is missing"
    }
}

$schemaRefs = @{}
Get-ChildItem (Join-Path $root 'agents') -Recurse -Filter '*.yml' -File | ForEach-Object {
    $raw = Get-Content $_.FullName -Raw
    foreach ($m in [regex]::Matches($raw, 'schemas/[^\s"'']+\.json')) {
        $ref = $m.Value
        if (-not $schemaRefs.ContainsKey($ref)) { $schemaRefs[$ref] = @() }
        $schemaRefs[$ref] += (Get-RelPath $_.FullName)
    }
}
foreach ($ref in ($schemaRefs.Keys | Sort-Object)) {
    if ($requiredSchemas -contains $ref) { continue }  # handled as HARD above
    if (-not (Test-Path (Join-Path $root $ref))) {
        $refBy = ($schemaRefs[$ref] | Select-Object -Unique) -join ', '
        $warns += "missing schema file '$ref' (referenced by: $refBy)"
    }
}

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
if ($warns) {
    Write-Host ''
    Write-Host 'WARNINGS (dangling schema refs — tracked backlog):' -ForegroundColor Yellow
    $warns | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}
if ($errors) {
    Write-Host ''
    Write-Host 'ERRORS:' -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit $global:EXIT_VALIDATION
}
Write-Host ''
Write-Host "Reference integrity: OK ($($agentNames.Count) agents resolved, $($warns.Count) schema warning(s))" -ForegroundColor Green
exit $global:EXIT_OK
