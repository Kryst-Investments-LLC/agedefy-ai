BeforeDiscovery {
    $script:root = Resolve-Path "$PSScriptRoot/.."
    $script:tools = @()
    $script:tools += Get-ChildItem (Join-Path $script:root 'tools') -Filter '*.ps1' -File |
                     Where-Object { $_.Name -ne '_common.ps1' -and $_.Name -ne 'platform-dev.ps1' }
    $script:tools += Get-ChildItem (Join-Path $script:root 'tools-v3') -Filter '*.ps1' -File
}

BeforeAll {
    $script:root = Resolve-Path "$PSScriptRoot/.."
}

Describe 'Tool scripts' {
    It '<_> exposes -Help' -ForEach $script:tools.FullName {
        (Get-Content $_ -Raw) | Should -Match '\[switch\]\s*\$Help'
    }

    It '<_> dot-sources _common.ps1' -ForEach $script:tools.FullName {
        (Get-Content $_ -Raw) | Should -Match '_common\.ps1'
    }

    It 'every v3 script in platform-dev menu exists on disk' {
        foreach ($name in 'v3-workflow-debugger','v3-orchestrator-visualizer','v3-agent-inspector','v3-jurisdiction-validator','v3-multi-platform-test','v3-release','v3-diff') {
            (Test-Path (Join-Path $script:root "tools-v3/$name.ps1")) | Should -BeTrue
        }
    }
}
