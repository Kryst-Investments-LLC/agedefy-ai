[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$Repository = "Kryst-Investments-LLC/finnexusai",
  [string]$StagingUrl = $env:STAGING_NEXTAUTH_URL,
  [string]$SmokeBaseUrl = $env:STAGING_SMOKE_BASE_URL,
  [string]$DatabaseUrl = $env:STAGING_DATABASE_URL,
  [string]$NextAuthSecret = $env:STAGING_NEXTAUTH_SECRET,
  [string]$RedisUrl = $env:STAGING_REDIS_URL,
  [string]$RedisToken = $env:STAGING_REDIS_TOKEN,
  [string]$OtelExporterOtlpEndpoint = $env:STAGING_OTEL_EXPORTER_OTLP_ENDPOINT,
  [string]$OtelServiceName = $(if ($env:STAGING_OTEL_SERVICE_NAME) { $env:STAGING_OTEL_SERVICE_NAME } elseif ($env:OTEL_SERVICE_NAME) { $env:OTEL_SERVICE_NAME } else { "biozephyra-ai-staging" }),
  [switch]$SkipEnableSchedule,
  [switch]$SkipOtelServiceNameVariable
)

$ErrorActionPreference = "Stop"

function Assert-CommandAvailable {
  param([string]$CommandName)

  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Required command '$CommandName' was not found in PATH."
  }
}

function Assert-NotBlank {
  param(
    [string]$Name,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "$Name is required."
  }
}

function Assert-HttpsUrl {
  param(
    [string]$Name,
    [string]$Value
  )

  Assert-NotBlank -Name $Name -Value $Value

  $uri = $null
  if (-not [System.Uri]::TryCreate($Value, [System.UriKind]::Absolute, [ref]$uri)) {
    throw "$Name must be an absolute URL."
  }

  if ($uri.Scheme -ne "https") {
    throw "$Name must use https."
  }

  if ($uri.Host -in @("localhost", "127.0.0.1", "0.0.0.0") -or $uri.Host.EndsWith(".local")) {
    throw "$Name must point at a stable hosted staging URL, not localhost or a machine-local hostname."
  }
}

function Assert-PostgresUrl {
  param(
    [string]$Name,
    [string]$Value
  )

  Assert-NotBlank -Name $Name -Value $Value

  if ($Value -notmatch '^(postgres|postgresql)://') {
    throw "$Name must be a PostgreSQL connection string."
  }
}

function Assert-MinimumSecretLength {
  param(
    [string]$Name,
    [string]$Value,
    [int]$MinimumLength
  )

  Assert-NotBlank -Name $Name -Value $Value

  if ($Value.Length -lt $MinimumLength) {
    throw "$Name must be at least $MinimumLength characters long."
  }
}

function Set-GitHubSecret {
  param(
    [string]$Name,
    [string]$Value
  )

  if (-not $PSCmdlet.ShouldProcess("$Repository secret $Name", "set")) {
    return
  }

  $Value | gh secret set $Name -R $Repository | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to set GitHub secret '$Name'."
  }
}

function Set-GitHubVariable {
  param(
    [string]$Name,
    [string]$Value
  )

  if (-not $PSCmdlet.ShouldProcess("$Repository variable $Name", "set")) {
    return
  }

  $Value | gh variable set $Name -R $Repository | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to set GitHub variable '$Name'."
  }
}

Assert-CommandAvailable -CommandName gh

try {
  gh auth status | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI is not authenticated for repository updates."
  }
} catch {
  throw "GitHub CLI is not authenticated for repository updates."
}

if ([string]::IsNullOrWhiteSpace($SmokeBaseUrl)) {
  $SmokeBaseUrl = $StagingUrl
}

Assert-HttpsUrl -Name "StagingUrl" -Value $StagingUrl
Assert-HttpsUrl -Name "SmokeBaseUrl" -Value $SmokeBaseUrl
Assert-PostgresUrl -Name "DatabaseUrl" -Value $DatabaseUrl
Assert-MinimumSecretLength -Name "NextAuthSecret" -Value $NextAuthSecret -MinimumLength 32
Assert-HttpsUrl -Name "RedisUrl" -Value $RedisUrl
Assert-NotBlank -Name "RedisToken" -Value $RedisToken
Assert-HttpsUrl -Name "OtelExporterOtlpEndpoint" -Value $OtelExporterOtlpEndpoint

Set-GitHubSecret -Name "STAGING_DATABASE_URL" -Value $DatabaseUrl
Set-GitHubSecret -Name "STAGING_NEXTAUTH_URL" -Value $StagingUrl
Set-GitHubSecret -Name "STAGING_NEXTAUTH_SECRET" -Value $NextAuthSecret
Set-GitHubSecret -Name "STAGING_REDIS_URL" -Value $RedisUrl
Set-GitHubSecret -Name "STAGING_REDIS_TOKEN" -Value $RedisToken
Set-GitHubSecret -Name "STAGING_OTEL_EXPORTER_OTLP_ENDPOINT" -Value $OtelExporterOtlpEndpoint
Set-GitHubSecret -Name "STAGING_SMOKE_BASE_URL" -Value $SmokeBaseUrl

if (-not $SkipOtelServiceNameVariable) {
  Set-GitHubVariable -Name "STAGING_OTEL_SERVICE_NAME" -Value $OtelServiceName
}

if (-not $SkipEnableSchedule) {
  Set-GitHubVariable -Name "STAGING_VALIDATION_ENABLED" -Value "true"
}

Write-Host "Configured staging validation settings for $Repository." -ForegroundColor Green
Write-Host "Secrets set: STAGING_DATABASE_URL, STAGING_NEXTAUTH_URL, STAGING_NEXTAUTH_SECRET, STAGING_REDIS_URL, STAGING_REDIS_TOKEN, STAGING_OTEL_EXPORTER_OTLP_ENDPOINT, STAGING_SMOKE_BASE_URL"

if (-not $SkipOtelServiceNameVariable) {
  Write-Host "Variable set: STAGING_OTEL_SERVICE_NAME=$OtelServiceName"
}

if (-not $SkipEnableSchedule) {
  Write-Host "Variable set: STAGING_VALIDATION_ENABLED=true"
}