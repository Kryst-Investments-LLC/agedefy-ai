BeforeDiscovery {
    $script:root = Resolve-Path "$PSScriptRoot/.."
    # Only enforce platform-layer conventions on agents owned by this layer.
    # Agents brought in from sibling repos (e.g. vercel-deployment-workflow-agent)
    # may follow different schemas and are excluded here.
    $script:upstreamAgents = @(
        'vercel-deployment-workflow-agent.yml',
        'agent-index.yml'
    )
    $script:agentFiles = Get-ChildItem (Join-Path $script:root 'agents') -Filter '*-agent.yml' -File |
        Where-Object { $script:upstreamAgents -notcontains $_.Name }
}

BeforeAll {
    Import-Module powershell-yaml -ErrorAction Stop
    $script:root = Resolve-Path "$PSScriptRoot/.."
    $script:agents = Get-ChildItem (Join-Path $script:root 'agents') -Filter '*-agent.yml' -File
}

Describe 'Agent specs' {
    It 'has at least the 18 expected agents' {
        $script:agents.Count | Should -BeGreaterOrEqual 18
    }

    It 'every agent file is parseable YAML — <_>' -ForEach $script:agentFiles.FullName {
        { Get-Content $_ -Raw | ConvertFrom-Yaml } | Should -Not -Throw
    }

    It '<_> has required keys' -ForEach $script:agentFiles.FullName {
        $y = Get-Content $_ -Raw | ConvertFrom-Yaml
        $y.name           | Should -Not -BeNullOrEmpty
        $y.version        | Should -Match '^\d+\.\d+\.\d+$'
        $y.role           | Should -Not -BeNullOrEmpty
        $y.owners         | Should -Not -BeNullOrEmpty
        $y.capabilities   | Should -Not -BeNullOrEmpty
        $y.sla            | Should -Not -BeNullOrEmpty
        $y.error_handling | Should -Not -BeNullOrEmpty
    }

    It '<_> has no duplicate top-level keys' -ForEach $script:agentFiles.FullName {
        $raw = Get-Content $_ -Raw
        $topKeys = ($raw -split "`n" | Where-Object { $_ -match '^[a-zA-Z_]+:' } | ForEach-Object { ($_ -split ':',2)[0] })
        ($topKeys | Group-Object | Where-Object Count -gt 1) | Should -BeNullOrEmpty
    }
}
