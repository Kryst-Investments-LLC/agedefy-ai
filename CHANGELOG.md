# Changelog

All notable changes to the **AgeDefy AI Platform layer** are documented
here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- JSON Schemas for `agent`, `workflow`, `legal-rule`, `intent`, `trace`.
- 17 declarative workflows mapping every README product module.
- Real legal rules with citations + `last_reviewed` for `us`, `eu`, `uk`,
  `ca`, `au`, `br`, `in`, plus US states `ca`, `ny`, `tx`, `fl`.
- 13 new agents: `safety`, `clinician-review`, `ai-personalization`,
  `telemedicine`, `marketplace`, `billing`, `community-moderation`,
  `research`, `knowledge-graph`, `observability`, `audit-governance`,
  `i18n`, plus expanded `entry`, `domain`, `business`,
  `master-orchestrator`, `law-awareness`.
- Controlled vocabulary in `metadata/`: `intents`, `compounds`,
  `pathways`, `biomarkers`, `lab_panels`, `products`.
- Six v3 tools: `v3-workflow-debugger`, `v3-orchestrator-visualizer`,
  `v3-agent-inspector`, `v3-jurisdiction-validator`,
  `v3-multi-platform-test`, `v3-diff`.
- `tools/replay-trace.ps1` and `tools/_common.ps1` shared helpers.
- CI workflows: `validate-agents`, `pester-tests`, `agent-simulation`,
  `lint`, `security`, `drift`, `release`.
- Pester suites: `agents`, `legal-rules`, `tools`, `simulation`; golden
  trace; eval dataset; red-team prompt set.
- Governance: `CODEOWNERS`, `SECURITY.md`, `SUPPORT.md`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `dependabot.yml`,
  `pre-commit-config.yaml`.

### Fixed
- Removed orphan `agents/legal-rules/.yml`.
- `agents/legal-rules/in.yml` jurisdiction code populated.
- Removed duplicate `instructions:` keys in
  `agents/law-awareness-agent.yml`; populated `platform_domain`.
- Added `name`, `version`, `description` to
  `agents/master-orchestrator-agent.yml`.
- Replaced stub CI with real schema + lint + Pester pipelines.
- Replaced product-layer README with platform-layer README; preserved
  product README as `README-product.md`.

## [0.1.0] - 2026-04-15
- Initial public scaffold.
