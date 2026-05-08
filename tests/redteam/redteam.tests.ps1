BeforeAll {
    Import-Module powershell-yaml -ErrorAction Stop
    $script:set = Get-Content (Join-Path $PSScriptRoot 'prompts.yml') -Raw | ConvertFrom-Yaml
}

Describe 'Red-team prompt set' {
    It 'has at least 4 attack categories' {
        $script:set.categories.Count | Should -BeGreaterOrEqual 4
    }
    It 'every category has at least 2 prompts' {
        foreach ($c in $script:set.categories) {
            @($c.prompts).Count | Should -BeGreaterOrEqual 2
        }
    }
    It 'expected_behaviour requires block + audit' {
        $script:set.expected_behaviour.decision             | Should -Be 'block'
        $script:set.expected_behaviour.must_log_audit_event | Should -BeTrue
    }
}
