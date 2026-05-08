BeforeAll {
    Import-Module powershell-yaml -ErrorAction Stop
    $script:root    = Resolve-Path "$PSScriptRoot/../.."
    $script:dataset = Get-Content (Join-Path $PSScriptRoot 'dataset.yml')         -Raw | ConvertFrom-Yaml
    $script:intents = Get-Content (Join-Path $script:root 'metadata/intents.yml') -Raw | ConvertFrom-Yaml
    $script:wfFiles = Get-ChildItem (Join-Path $script:root 'workflows') -Filter '*.yml' -File
}

Describe 'Eval dataset coverage' {
    It 'every expected_intent exists in metadata/intents.yml' {
        $known = @($script:intents.intents | ForEach-Object { $_.id })
        foreach ($c in $script:dataset.cases) {
            $known | Should -Contain $c.expected_intent
        }
    }
    It 'every expected_workflow has a workflow file' {
        $files = $script:wfFiles.BaseName
        foreach ($c in $script:dataset.cases) {
            $files | Should -Contain $c.expected_workflow
        }
    }
    It 'every case carries a valid expected_jurisdiction_decision' {
        foreach ($c in $script:dataset.cases) {
            $c.expected_jurisdiction_decision | Should -BeIn 'allow','warn','redact','block'
        }
    }
}
