param(
  [string]$TaskName = 'Biozephyra Outbox Dispatch',
  [ValidateSet('kafka', 'pubsub')]
  [string]$Broker = 'kafka',
  [int]$BatchSize = 100,
  [int]$MaxAttempts = 5,
  [int]$RetryDelayMs = 30000,
  [int]$RepeatMinutes = 15,
  [string]$TenantId = ''
)

$ErrorActionPreference = 'Stop'

$pwsh = (Get-Command pwsh).Source
$scriptPath = Join-Path $PSScriptRoot 'run-outbox-dispatch.ps1'
$argumentList = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', ('"{0}"' -f $scriptPath),
  '-Broker', $Broker,
  '-BatchSize', $BatchSize,
  '-MaxAttempts', $MaxAttempts,
  '-RetryDelayMs', $RetryDelayMs
)

if ($TenantId) {
  $argumentList += @('-TenantId', $TenantId)
}

$action = New-ScheduledTaskAction -Execute $pwsh -Argument ($argumentList -join ' ')
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes $RepeatMinutes)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Dispatches canonical health event outbox batches.' -Force