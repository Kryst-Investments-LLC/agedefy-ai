<#
.SYNOPSIS
  Look up biomarker reference ranges from metadata/biomarkers.yml and
  produce a non-diagnostic interpretation string.
.PARAMETER Marker
  Biomarker id (e.g. hba1c, ldl, hscrp).
.PARAMETER Value
  Numeric value to compare against the reference range.
#>
[CmdletBinding()]
param(
  [string]$Marker,
  [Nullable[double]]$Value,
  [switch]$Help
)

. (Join-Path $PSScriptRoot '_common.ps1')
if ($Help) { Show-HelpAndExit -ScriptPath $MyInvocation.MyCommand.Path }
Assert-PowerShellYaml
if (-not $Marker -or $null -eq $Value) { Write-Error 'Marker and Value are required'; exit $EXIT_VALIDATION }

$root = Get-PlatformRoot
$y    = Read-Yaml (Join-Path $root 'metadata/biomarkers.yml')
$entry = $y.biomarkers | Where-Object { $_.id -eq $Marker } | Select-Object -First 1
if (-not $entry) { Write-Error "Unknown biomarker: $Marker"; exit $EXIT_VALIDATION }

$band = 'within range'
if ($entry.optimal_min -ne $null -and $Value -lt [double]$entry.optimal_min) { $band = 'below optimal' }
if ($entry.optimal_max -ne $null -and $Value -gt [double]$entry.optimal_max) { $band = 'above optimal' }

[pscustomobject]@{
    marker        = $Marker
    value         = $Value
    unit          = $entry.unit
    band          = $band
    optimal_range = "$($entry.optimal_min) - $($entry.optimal_max) $($entry.unit)"
    disclaimer    = 'General interpretation only — not a medical diagnosis.'
} | Format-List | Out-String | Write-Host
exit $EXIT_OK
