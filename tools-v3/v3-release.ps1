param(
    [string]\
)

if (-not \) {
    Write-Host 'Usage: .\tools-v3\v3-release.ps1 -NewVersion 0.2.0'
    exit 1
}

\ = Join-Path \ '..\version.json'
\ = Get-Content \ -Raw | ConvertFrom-Json
\.version = \
\.releaseChannel = 'stable'
\ | ConvertTo-Json -Depth 5 | Out-File \ -Encoding UTF8

Write-Host "Updated version.json to version \"

git add \
git commit -m "Release \" --allow-empty
git tag "v\"
git push origin main --tags
