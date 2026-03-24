param([string]$Action)

$platformName  = 'agedefy-ai'
$sampleQuery   = 'Interpret basic biomarkers for longevity context.'
$primaryTool   = 'analyze-biomarkers.ps1'

$platformRoot  = Split-Path $PSScriptRoot -Parent
$agentsPath    = Join-Path $platformRoot 'agents'
$toolsPath     = Join-Path $platformRoot 'tools'
$legalRulesDir = Join-Path $agentsPath 'legal-rules'

# ================================
# YAML HELPERS
# ================================
function Read-YamlFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    try {
        Get-Content $Path -Raw | ConvertFrom-Yaml
    } catch {
        'YAML parse error: ' + $Path
        return $null
    }
}

function Get-AgentYaml {
    param([string]$Name)
    $p = Join-Path $agentsPath $Name
    Read-YamlFile -Path $p
}

# ================================
# DASHBOARD
# ================================
function Show-Dashboard {
    '===================================================='
    ' ' + $platformName.ToUpper() + ' - CAPABILITY DASHBOARD (V3)'
    '===================================================='

    '[Agents]'
    if (Test-Path $agentsPath) {
        Get-ChildItem $agentsPath -Filter '*agent.yml' | ForEach-Object { '  - ' + $_.Name }
    }

    ''
    '[Tools]'
    if (Test-Path $toolsPath) {
        Get-ChildItem $toolsPath -Filter '*.ps1' | ForEach-Object { '  - ' + $_.Name }
    }

    ''
    '[Jurisdictions]'
    if (Test-Path $legalRulesDir) {
        Get-ChildItem $legalRulesDir -Filter '*.yml' | ForEach-Object { '  - ' + $_.Name }
    }
}

# ================================
# CAPABILITY MAP (DYNAMIC)
# ================================
function Show-CapabilityMap {
    ''
    '--- CAPABILITY MAP (V3) ---'
    'Platform: ' + $platformName

    $domainYaml   = Get-AgentYaml -Name 'domain-agent.yml'
    $businessYaml = Get-AgentYaml -Name 'business-agent.yml'

    'Domain agent:'
    if ($domainYaml) {
        if ($domainYaml.intent)   { '  intents:   ' + ($domainYaml.intent   -join ', ') }
        if ($domainYaml.workflows){ '  workflows: ' + ($domainYaml.workflows -join ', ') }
        if ($domainYaml.reasoning){ '  reasoning: ' + ($domainYaml.reasoning -join ', ') }
    }

    ''
    'Business agent:'
    if ($businessYaml) {
        if ($businessYaml.workflows){ '  workflows: ' + ($businessYaml.workflows -join ', ') }
        if ($businessYaml.tools)    { '  tools:     ' + ($businessYaml.tools     -join ', ') }
        if ($businessYaml.workflowMap) {
            '  workflowMap keys: ' + ($businessYaml.workflowMap.Keys -join ', ')
        }
    }
}

# ================================
# INTENT + WORKFLOW EXTRACTION
# ================================
function Detect-Intent {
    param([string]$Query)

    $domainYaml = Get-AgentYaml -Name 'domain-agent.yml'
    if (-not $domainYaml -or -not $domainYaml.intent) {
        return 'unknown.intent'
    }

    $q = $Query.ToLower()
    foreach ($i in $domainYaml.intent) {
        if ($q -like ('*' + $i.Split('.')[-1].ToLower() + '*')) {
            return $i
        }
    }
    return $domainYaml.intent[0]
}

function Get-WorkflowForIntent {
    param([string]$Intent)

    $businessYaml = Get-AgentYaml -Name 'business-agent.yml'
    if (-not $businessYaml) { return $null }

    if ($businessYaml.workflowMap) {
        if ($businessYaml.workflowMap.ContainsKey($Intent)) {
            return $businessYaml.workflowMap[$Intent]
        }
    }

    if ($businessYaml.workflows -and $businessYaml.workflows.Count -gt 0) {
        return $businessYaml.workflows[0]
    }

    return $null
}

# ================================
# SIMULATION (DYNAMIC)
# ================================
function Run-Simulation {
    ''
    '--- SIMULATION (V3) ---'
    'Platform: ' + $platformName
    'Sample query: ' + $sampleQuery

    $intent   = Detect-Intent -Query $sampleQuery
    $workflow = Get-WorkflowForIntent -Intent $intent

    'Detected intent:   ' + $intent
    if ($workflow) {
        'Selected workflow: ' + $workflow
    } else {
        'No workflow mapped; using default business flow.'
    }

    ''
    '--- ORCHESTRATOR TRACE (V3) ---'
    '[entry-agent] parsed query -> intent: ' + $intent
    '[orchestrator] route: domain-agent -> business-agent -> law-awareness-agent'
    '[domain-agent] applies domain reasoning for intent: ' + $intent
    if ($workflow) {
        '[business-agent] runs workflow: ' + $workflow
    } else {
        '[business-agent] runs default workflow'
    }
    '[law-awareness-agent] checks jurisdiction rules'
    '[final] composed answer'
}

# ================================
# TOOL RUNNER (V3)
# ================================
function Run-Tools {
    ''
    '--- RUN TOOLS (V3) ---'
    'Platform: ' + $platformName

    if (-not (Test-Path $toolsPath)) {
        'Tools folder missing.'
        return
    }

    $tools = Get-ChildItem $toolsPath -Filter '*.ps1' | Where-Object { $_.Name -ne 'platform-dev.ps1' }
    if (-not $tools) {
        'No tools found.'
        return
    }

    'Available tools:'
    $i = 1
    foreach ($t in $tools) {
        '  ' + $i + ') ' + $t.Name
        $i++
    }

    ''
    'Primary domain tool: ' + $primaryTool
    if ($primaryTool -ne '' -and (Test-Path (Join-Path $toolsPath $primaryTool))) {
        ''
        'Running primary tool: ' + $primaryTool
        & (Join-Path $toolsPath $primaryTool)
    } else {
        'Primary tool not configured or not found.'
    }
}

# ================================
# TEST SUITE (V3)
# ================================
function Test-Platform {
    ''
    '--- PLATFORM TEST SUITE (V3) ---'
    'Platform: ' + $platformName

    $errors = @()

    $requiredAgents = @(
        'entry-agent.yml',
        'master-orchestrator-agent.yml',
        'domain-agent.yml',
        'business-agent.yml',
        'law-awareness-agent.yml'
    )

    foreach ($ra in $requiredAgents) {
        $p = Join-Path $agentsPath $ra
        if (-not (Test-Path $p)) {
            $errors += 'Missing agent: ' + $ra
        } else {
            $y = Read-YamlFile -Path $p
            if (-not $y) {
                $errors += 'Invalid YAML: ' + $ra
            }
        }
    }

    if (-not (Test-Path $legalRulesDir)) {
        $errors += 'legal-rules folder missing'
    }

    if ($errors.Count -eq 0) {
        'All v3 platform checks passed.'
    } else {
        'Platform issues:'
        foreach ($e in $errors) { '  - ' + $e }
    }
}

# ============================
# V3 TOOLS MENU START
# ============================
function Show-V3ToolsMenu {
    while ($true) {
        Clear-Host
        Write-Host "==============================================="
        Write-Host "  V3 TOOLS"
        Write-Host "==============================================="
        Write-Host "1) Workflow Debugger"
        Write-Host "2) Orchestrator Visualizer"
        Write-Host "3) Agent Inspector"
        Write-Host "4) Jurisdiction Validator"
        Write-Host "5) Multi-Platform Test Runner"
        Write-Host "6) Release Script"
        Write-Host "7) Diff Tool"
        Write-Host "0) Back"
        $choice = Read-Host "Select"

        switch ($choice) {
            "1" { & "$platformRoot\tools-v3\v3-workflow-debugger.ps1"; Pause }
            "2" { & "$platformRoot\tools-v3\v3-orchestrator-visualizer.ps1"; Pause }
            "3" { & "$platformRoot\tools-v3\v3-agent-inspector.ps1"; Pause }
            "4" { & "$platformRoot\tools-v3\v3-jurisdiction-validator.ps1"; Pause }
            "5" { & "$platformRoot\tools-v3\v3-multi-platform-test.ps1"; Pause }
            "6" { & "$platformRoot\tools-v3\v3-release.ps1"; Pause }
            "7" { & "$platformRoot\tools-v3\v3-diff.ps1"; Pause }
            "0" { return }
            default { 'Invalid option.' }
        }
    }
}
# ============================
# V3 TOOLS MENU END
# ============================

# ================================
# MENU
# ================================
function Show-Menu {
    while ($true) {
        ''
        '======================================'
        ' ' + $platformName + ' - DEV MENU (V3)'
        '======================================'
        '1) Dashboard'
        '2) Capability Map'
        '3) Simulation'
        '4) Run Tools'
        '5) Test Platform'
        '6) V3 Tools'
        '0) Exit'
        ''
        $choice = Read-Host 'Select an option'

        switch ($choice) {
            '1' { Show-Dashboard }
            '2' { Show-CapabilityMap }
            '3' { Run-Simulation }
            '4' { Run-Tools }
            '5' { Test-Platform }
            '6' { Show-V3ToolsMenu }
            '0' { return }
            default { 'Invalid option.' }
        }
    }
}

if ($Action) {
    switch ($Action) {
        'dashboard' { Show-Dashboard }
        'map'       { Show-CapabilityMap }
        'sim'       { Run-Simulation }
        'tools'     { Run-Tools }
        'test'      { Test-Platform }
        default     { Show-Menu }
    }
} else {
    Show-Menu
}



