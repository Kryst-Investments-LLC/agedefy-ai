param(
    [string]$EnvFile = "k8s/base/secrets/outbox-dispatch.env",
    [string]$SecretName = "biozephyra-outbox-dispatch-secrets",
    [string]$Namespace = "default",
    [string]$OutputPath = "k8s/outbox-dispatch-sealed-secret.yaml",
    [switch]$RawSecretOnly
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) {
    throw "Env file not found: $EnvFile"
}

$kubectl = Get-Command kubectl -ErrorAction SilentlyContinue
if (-not $kubectl) {
    throw "kubectl is required to generate the Secret manifest."
}

$secretYaml = kubectl create secret generic $SecretName `
    --namespace $Namespace `
    --from-env-file=$EnvFile `
    --dry-run=client `
    -o yaml

if ($LASTEXITCODE -ne 0) {
    throw "kubectl failed to generate the Secret manifest."
}

if ($RawSecretOnly) {
    Set-Content -Path $OutputPath -Value $secretYaml
    Write-Host "Wrote raw Secret manifest to $OutputPath"
    exit 0
}

$kubeseal = Get-Command kubeseal -ErrorAction SilentlyContinue
if (-not $kubeseal) {
    throw "kubeseal is required unless -RawSecretOnly is used."
}

$sealedSecretYaml = $secretYaml | kubeseal --format yaml

if ($LASTEXITCODE -ne 0) {
    throw "kubeseal failed to encrypt the Secret manifest."
}

Set-Content -Path $OutputPath -Value $sealedSecretYaml
Write-Host "Wrote SealedSecret manifest to $OutputPath"