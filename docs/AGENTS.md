# Platform-Specific Agents for Biozephyra

This repo is wired with platform-specific agents and legal tooling to provide:

- Domain-correct intelligence
- Compliance-by-design workflows
- Deterministic, auditable behavior

## Domain focus

This platform focuses on:
* - Biomarkers, compound interactions, protocol safety
* - Telemedicine and clinician licensing rules

## Agents layout

- agents/ - platform-specific agents and legal rules
- agents/legal-rules/ - jurisdiction YAML (country, region, city)

## Tooling

- tools/add-country.ps1 - add country-level legal rules
- tools/add-state.ps1 - add region/state-level rules
- tools/fix-legal-rules.ps1 - auto-fix missing sections
- tools/validate-legal-rules.ps1 - CI validator
- tools/jurisdiction-dashboard.ps1 - coverage dashboard
- tools/search-rules.ps1 - rule search engine
- tools/diff-jurisdictions.ps1 - diff viewer
- tools/export-jurisdiction-pack.ps1 - client export packs

## VS Code integration

- .vscode/settings.json pins:
  - compliance.platform = Biozephyra
  - compliance.agentsPath = agents/
  - compliance.toolsPath  = tools/

## CI validation

- .github/workflows/legal-rules.yml runs tools/validate-legal-rules.ps1

