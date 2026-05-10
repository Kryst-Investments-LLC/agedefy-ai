# Rollout the GitHub Packages PAT to all 5 platform repos as a secret.
# Usage: $env:KRYST_PAT = 'ghp_...'; .\tools\rollout-packages-token.ps1

if (-not $env:KRYST_PAT) {
    # Try to hydrate from persisted User-scope env var
    $env:KRYST_PAT = [Environment]::GetEnvironmentVariable('KRYST_PAT', 'User')
}
if (-not $env:KRYST_PAT) {
    Write-Host "ERROR: `$env:KRYST_PAT is not set (process or User scope)." -ForegroundColor Red
    Write-Host "Run: `$env:KRYST_PAT = 'ghp_...'  then re-run this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "Token detected: Length=$($env:KRYST_PAT.Length) Prefix=$($env:KRYST_PAT.Substring(0,4))" -ForegroundColor Cyan

# --- Step 1: Validate token can authenticate ---
Write-Host "`n=== Validating token ===" -ForegroundColor Cyan
$headers = @{ Authorization = "token $env:KRYST_PAT"; Accept = 'application/vnd.github+json' }
try {
    $user = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $headers -TimeoutSec 10
    Write-Host "  [OK] Authenticated as: $($user.login)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Token rejected: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# --- Step 2: Validate token can read org packages ---
try {
    $pkgs = Invoke-RestMethod -Uri 'https://api.github.com/orgs/Kryst-Investments-LLC/packages?package_type=npm' -Headers $headers -TimeoutSec 10
    Write-Host "  [OK] Org packages visible: $($pkgs.Count)" -ForegroundColor Green
    $pkgs | ForEach-Object { Write-Host "       - $($_.name) v$($_.version)" }
} catch {
    Write-Host "  [WARN] Cannot list org packages: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "         If this says 'SSO required', go to https://github.com/settings/tokens" -ForegroundColor Yellow
    Write-Host "         and click 'Configure SSO' next to the token, then Authorize for Kryst-Investments-LLC." -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne 'y') { exit 1 }
}

# --- Step 3: Push secret to all 5 repos ---
Write-Host "`n=== Pushing GH_PACKAGES_TOKEN secret to 5 repos ===" -ForegroundColor Cyan
$repos = @(
    'Kryst-Investments-LLC/agedefy-ai',
    'Kryst-Investments-LLC/autopilot-ventures',
    'Kryst-Investments-LLC/conmates',
    'Kryst-Investments-LLC/finnexusai',
    'Kryst-Investments-LLC/Neurohires'
)
foreach ($r in $repos) {
    try {
        $env:KRYST_PAT | gh secret set GH_PACKAGES_TOKEN --repo $r --body - 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] $r" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] $r (exit $LASTEXITCODE)" -ForegroundColor Red
        }
    } catch {
        Write-Host "  [FAIL] $r : $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. I'll patch each repo's .npmrc to use `${GH_PACKAGES_TOKEN}"
Write-Host "  2. I'll re-run the failing CI workflows on the 3 UNSTABLE PRs"
Write-Host "  3. You add the same token to Vercel projects (5 of them)"
Write-Host "  4. I'll merge the 5 PRs once green"
