param(
  [ValidateSet('kafka', 'pubsub')]
  [string]$Broker = 'kafka',
  [int]$BatchSize = 100,
  [int]$MaxAttempts = 5,
  [int]$RetryDelayMs = 30000,
  [string]$TenantId = ''
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$arguments = @('outbox:dispatch', '--', '--broker', $Broker, '--batch-size', $BatchSize, '--max-attempts', $MaxAttempts, '--retry-delay-ms', $RetryDelayMs)
if ($TenantId) {
  $arguments += @('--tenant', $TenantId)
}

pnpm @arguments
exit $LASTEXITCODE