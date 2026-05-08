BeforeAll {
    $script:root = Resolve-Path "$PSScriptRoot/.."
}

Describe 'Headless platform simulation' {
    It 'Test-Platform passes' {
        $output = & (Join-Path $script:root 'tools/platform-dev.ps1') -Action Test 2>&1 | Out-String
        $output | Should -Match 'All v3 platform checks passed'
    }

    It 'Run-Simulation matches golden output (loose contains check)' {
        $expected = Get-Content (Join-Path $PSScriptRoot 'golden/simulation.golden.txt') -Raw
        $actual   = & (Join-Path $script:root 'tools/platform-dev.ps1') -Action Simulation 2>&1 | Out-String
        foreach ($line in ($expected -split "`n" | Where-Object { $_.Trim() })) {
            $actual | Should -Match ([regex]::Escape($line.Trim()))
        }
    }
}
