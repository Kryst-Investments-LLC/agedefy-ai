# tools/biotech/rdkit-features.ps1
# Delegates to a Python sidecar that uses RDKit / DeepChem to compute
# molecular descriptors and Tanimoto similarity. Used by
# compound-interaction-agent.

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Smiles,
    [string]$ReferenceSmiles,
    [string]$Python = ($env:AGEDEFY_PYTHON ? $env:AGEDEFY_PYTHON : 'python'),
    [switch]$Help
)

. "$PSScriptRoot/../_common.ps1"
if ($Help) {
    Write-Host "Usage: rdkit-features.ps1 -Smiles <smiles> [-ReferenceSmiles <smiles>]"
    exit $global:EXIT_OK
}

$py = @'
import json, sys
try:
    from rdkit import Chem
    from rdkit.Chem import AllChem, Descriptors, DataStructs
except ImportError:
    print(json.dumps({"error": "rdkit_not_installed"}))
    sys.exit(4)

smiles = sys.argv[1]
ref = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None
mol = Chem.MolFromSmiles(smiles)
if mol is None:
    print(json.dumps({"error": "invalid_smiles", "input": smiles})); sys.exit(1)

out = {
    "mw":     Descriptors.MolWt(mol),
    "logp":   Descriptors.MolLogP(mol),
    "tpsa":   Descriptors.TPSA(mol),
    "hbd":    Descriptors.NumHDonors(mol),
    "hba":    Descriptors.NumHAcceptors(mol),
    "rotb":   Descriptors.NumRotatableBonds(mol),
    "rings":  Descriptors.RingCount(mol),
}

if ref:
    rmol = Chem.MolFromSmiles(ref)
    if rmol is not None:
        fp1 = AllChem.GetMorganFingerprintAsBitVect(mol, 2, 2048)
        fp2 = AllChem.GetMorganFingerprintAsBitVect(rmol, 2, 2048)
        out["tanimoto"] = DataStructs.TanimotoSimilarity(fp1, fp2)

print(json.dumps(out))
'@

$tmp = New-TemporaryFile
try {
    Set-Content -Path $tmp -Value $py -Encoding UTF8
    $args = @($tmp, $Smiles)
    if ($ReferenceSmiles) { $args += $ReferenceSmiles }
    & $Python @args
    $code = $LASTEXITCODE
    exit $code
} finally {
    Remove-Item $tmp -ErrorAction SilentlyContinue
}
