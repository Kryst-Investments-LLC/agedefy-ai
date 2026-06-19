<#
.SYNOPSIS
  Forward Biozephyra JSONL trace records to an OTLP/HTTP collector.

.DESCRIPTION
  Reads ./traces/orchestrator.jsonl (or any file matching the
  trace.schema.json contract), batches records, converts each to an
  OTLP/HTTP `logs` envelope (we use the OTLP logs signal because trace
  records arrive after-the-fact and are not parent/child spans), and
  POSTs to $env:OTEL_EXPORTER_OTLP_ENDPOINT (default
  http://localhost:4318/v1/logs).

  Uses the same redaction rules as the collector's
  `attributes/redact-pii` processor as a defense-in-depth measure: PII
  fields are stripped client-side before they ever leave the host.

.PARAMETER Path
  JSONL file to forward (default ./traces/orchestrator.jsonl).

.PARAMETER Tail
  Follow the file (like `tail -f`) and stream new lines as they arrive.

.PARAMETER BatchSize
  Records per OTLP envelope (default 64).

.PARAMETER Endpoint
  Override the OTLP/HTTP logs endpoint.

.PARAMETER DryRun
  Print the OTLP payload to stdout instead of POSTing.

.EXAMPLE
  ./tools-v3/v3-trace-otlp-exporter.ps1
  ./tools-v3/v3-trace-otlp-exporter.ps1 -Tail
  ./tools-v3/v3-trace-otlp-exporter.ps1 -DryRun
#>
[CmdletBinding()]
param(
    [string] $Path,
    [switch] $Tail,
    [int]    $BatchSize = 64,
    [string] $Endpoint,
    [switch] $DryRun,
    [switch] $Help
)

. (Join-Path $PSScriptRoot '..\tools\_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }

$root = Get-PlatformRoot
if (-not $Path) { $Path = Join-Path $root 'traces\orchestrator.jsonl' }
if (-not $Endpoint) {
    $Endpoint = if ($env:OTEL_EXPORTER_OTLP_ENDPOINT) {
        ($env:OTEL_EXPORTER_OTLP_ENDPOINT.TrimEnd('/')) + '/v1/logs'
    } else {
        'http://localhost:4318/v1/logs'
    }
}

if (-not (Test-Path $Path)) {
    Write-Host "[!] No trace file at $Path. Nothing to export." -ForegroundColor Yellow
    exit $EXIT_OK
}

$piiFields = @('user.email', 'user.id', 'payload.user_email', 'payload.user_phone',
               'patient_id', 'mrn', 'dob', 'phi')

function ConvertTo-OtlpLog {
    param([Parameter(Mandatory)][hashtable]$Record)

    $attrs = @()
    foreach ($k in $Record.Keys) {
        if ($k -in @('runId', 'ts')) { continue }
        if ($piiFields -contains $k) { continue }
        $v = $Record[$k]
        $val = if ($v -is [int] -or $v -is [long]) { @{ intValue = "$v" } }
               elseif ($v -is [bool])              { @{ boolValue = $v } }
               elseif ($v -is [array])             { @{ stringValue = ($v -join ',') } }
               else                                { @{ stringValue = "$v" } }
        $attrs += @{ key = "biozephyra.$k"; value = $val }
    }

    $tsNano = if ($Record.ts) {
        ([datetimeoffset]::Parse($Record.ts)).ToUnixTimeMilliseconds() * 1000000
    } else {
        ([datetimeoffset]::UtcNow).ToUnixTimeMilliseconds() * 1000000
    }

    $sev = switch ($Record.decision) {
        'block' { @{ n = 17; t = 'ERROR' } }
        'warn'  { @{ n = 13; t = 'WARN' } }
        'error' { @{ n = 17; t = 'ERROR' } }
        default { @{ n = 9;  t = 'INFO' } }
    }

    return @{
        timeUnixNano   = "$tsNano"
        severityNumber = $sev.n
        severityText   = $sev.t
        body           = @{ stringValue = "$($Record.agent) -> $($Record.decision) ($($Record.intent))" }
        attributes     = $attrs
        traceId        = if ($Record.runId) { ($Record.runId -replace '-','').PadRight(32,'0').Substring(0,32) } else { '0' * 32 }
    }
}

function Send-Batch {
    param([Parameter(Mandatory)][array]$Records)
    if (-not $Records -or $Records.Count -eq 0) { return }

    $logRecords = $Records | ForEach-Object { ConvertTo-OtlpLog -Record $_ }

    $envelope = @{
        resourceLogs = @(@{
            resource = @{
                attributes = @(
                    @{ key = 'service.name';            value = @{ stringValue = 'biozephyra-ai' } }
                    @{ key = 'deployment.environment';  value = @{ stringValue = ($env:BIOZEPHYRA_ENV ?? 'dev') } }
                )
            }
            scopeLogs = @(@{
                scope      = @{ name = 'biozephyra.orchestrator'; version = '1.0.0' }
                logRecords = $logRecords
            })
        })
    }

    $json = $envelope | ConvertTo-Json -Depth 12 -Compress

    if ($DryRun) {
        Write-Host $json
        return
    }

    try {
        $headers = @{ 'Content-Type' = 'application/json' }
        if ($env:OTEL_EXPORTER_OTLP_HEADERS) {
            foreach ($pair in ($env:OTEL_EXPORTER_OTLP_HEADERS -split ',')) {
                $kv = $pair.Split('=', 2)
                if ($kv.Count -eq 2) { $headers[$kv[0].Trim()] = $kv[1].Trim() }
            }
        }
        Invoke-RestMethod -Method Post -Uri $Endpoint -Headers $headers -Body $json -TimeoutSec 10 | Out-Null
        Write-Host "  -> exported $($Records.Count) records to $Endpoint" -ForegroundColor Green
    } catch {
        Write-Host "[!] OTLP export failed: $($_.Exception.Message)" -ForegroundColor Red
        # buffer-and-retry policy: write the failed batch back to a DLQ file
        $dlq = Join-Path $root 'traces\otlp-dlq.jsonl'
        $Records | ForEach-Object { ($_ | ConvertTo-Json -Depth 8 -Compress) } | Add-Content -Path $dlq
    }
}

function Read-JsonLines {
    param([Parameter(Mandatory)][string]$File)
    Get-Content -Path $File -Encoding UTF8 | Where-Object { $_ -and $_.Trim() } | ForEach-Object {
        try { ConvertFrom-Json -InputObject $_ -AsHashtable } catch { $null }
    } | Where-Object { $_ }
}

if ($Tail) {
    Write-Host "[+] Tailing $Path -> $Endpoint (Ctrl-C to stop)" -ForegroundColor Cyan
    Get-Content -Path $Path -Wait -Tail 0 -Encoding UTF8 | ForEach-Object -Begin { $buf = @() } -Process {
        if ($_ -and $_.Trim()) {
            try {
                $buf += (ConvertFrom-Json -InputObject $_ -AsHashtable)
            } catch { return }
            if ($buf.Count -ge $BatchSize) {
                Send-Batch -Records $buf
                $buf = @()
            }
        }
    }
} else {
    $records = Read-JsonLines -File $Path
    Write-Host "[+] $($records.Count) records to export -> $Endpoint" -ForegroundColor Cyan
    for ($i = 0; $i -lt $records.Count; $i += $BatchSize) {
        $end = [Math]::Min($i + $BatchSize, $records.Count) - 1
        Send-Batch -Records $records[$i..$end]
    }
}

exit $EXIT_OK
