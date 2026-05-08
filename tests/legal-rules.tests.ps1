BeforeDiscovery {
    $script:root = Resolve-Path "$PSScriptRoot/.."
    $script:ruleFiles = @()
    $script:ruleFiles += Get-ChildItem (Join-Path $script:root 'agents/legal-rules')           -Filter '*.yml' -File
    $script:ruleFiles += Get-ChildItem (Join-Path $script:root 'agents/legal-rules/us-states') -Filter '*.yml' -File -ErrorAction SilentlyContinue
}

BeforeAll {
    Import-Module powershell-yaml -ErrorAction Stop
}

Describe 'Legal rule files' {
    It '<_> parses' -ForEach $script:ruleFiles.FullName {
        { Get-Content $_ -Raw | ConvertFrom-Yaml } | Should -Not -Throw
    }

    It '<_> has jurisdiction.code populated' -ForEach $script:ruleFiles.FullName {
        $y = Get-Content $_ -Raw | ConvertFrom-Yaml
        $y.jurisdiction.code | Should -Not -BeNullOrEmpty
        $y.jurisdiction.code | Should -Match '^[a-z]{2}(-[a-z0-9]{2,3})?$'
    }

    It '<_> has last_reviewed within 12 months' -ForEach $script:ruleFiles.FullName {
        $y = Get-Content $_ -Raw | ConvertFrom-Yaml
        $y.last_reviewed | Should -Not -BeNullOrEmpty
        $age = (Get-Date) - [datetime]::Parse($y.last_reviewed)
        $age.TotalDays | Should -BeLessThan 365
    }

    It '<_> rules carry citations + valid severity' -ForEach $script:ruleFiles.FullName {
        $y = Get-Content $_ -Raw | ConvertFrom-Yaml
        foreach ($r in @($y.rules)) {
            $r.citations | Should -Not -BeNullOrEmpty
            $r.severity  | Should -BeIn 'low','medium','high','critical'
        }
    }
}
