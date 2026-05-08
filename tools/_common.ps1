# AgeDefy AI — shared helpers for tools and tools-v3
# dot-source: . "$PSScriptRoot/_common.ps1"

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Standard exit codes
$global:EXIT_OK              = 0
$global:EXIT_VALIDATION      = 1
$global:EXIT_RUNTIME         = 2
$global:EXIT_SCHEMA          = 3
$global:EXIT_MISSING_DEP     = 4

function Get-PlatformRoot {
    # _common.ps1 lives in either tools/ or tools-v3/ — go up one level
    Split-Path $PSScriptRoot -Parent
}

function Assert-PowerShellYaml {
    if (-not (Get-Module -ListAvailable -Name 'powershell-yaml')) {
        Write-Host "[!] powershell-yaml module not installed." -ForegroundColor Yellow
        Write-Host "    Install with:  Install-Module powershell-yaml -Scope CurrentUser" -ForegroundColor Yellow
        exit $global:EXIT_MISSING_DEP
    }
    Import-Module powershell-yaml -ErrorAction Stop | Out-Null
}

function Read-Yaml {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    try {
        Get-Content $Path -Raw | ConvertFrom-Yaml
    } catch {
        Write-Warning "YAML parse error in $Path : $_"
        return $null
    }
}

function Get-AgentFiles {
    Get-ChildItem (Join-Path (Get-PlatformRoot) 'agents') -Filter '*-agent.yml' -File
}

function Get-WorkflowFiles {
    $dir = Join-Path (Get-PlatformRoot) 'workflows'
    if (Test-Path $dir) { Get-ChildItem $dir -Filter '*.yml' -File } else { @() }
}

function Get-LegalRuleFiles {
    $dir = Join-Path (Get-PlatformRoot) 'agents/legal-rules'
    if (Test-Path $dir) {
        Get-ChildItem $dir -Recurse -Filter '*.yml' -File
    } else { @() }
}

function Write-StepHeader {
    param([string]$Title)
    Write-Host ''
    Write-Host ('=' * 60) -ForegroundColor DarkCyan
    Write-Host (" $Title") -ForegroundColor Cyan
    Write-Host ('=' * 60) -ForegroundColor DarkCyan
}

function Show-HelpAndExit {
    param([string]$ScriptName, [string]$Synopsis, [string[]]$Examples)
    Write-Host ''
    Write-Host "NAME:    $ScriptName" -ForegroundColor Cyan
    Write-Host "PURPOSE: $Synopsis"
    Write-Host ''
    Write-Host 'OPTIONS:'
    Write-Host '  -Help      Show this help and exit.'
    Write-Host '  -WhatIf    Dry run; no side effects.'
    Write-Host '  -Verbose   Verbose output.'
    if ($Examples) {
        Write-Host ''
        Write-Host 'EXAMPLES:'
        $Examples | ForEach-Object { Write-Host "  $_" }
    }
    Write-Host ''
    exit $global:EXIT_OK
}
