# Contributing to AgeDefy AI Platform

Thanks for helping. The platform layer is the contract surface that the
Next.js product depends on, so every change is gated by CI.

## Workflow

1. Fork & branch from `main`. Branch names: `feat/…`, `fix/…`, `docs/…`,
   `legal/…`.
2. Make focused changes. Update [CHANGELOG.md](CHANGELOG.md).
3. Run locally:
   ```powershell
   ./tools-v3/v3-jurisdiction-validator.ps1
   Invoke-Pester ./tests -Output Detailed
   ```
4. Open a PR. CI must be green before review:
   - `validate-agents` (yamllint + ajv schemas + dup-key check)
   - `pester-tests` (≥ 80 % coverage)
   - `agent-simulation` (golden trace)
   - `lint`, `security`
5. Code owners (see `.github/CODEOWNERS`) auto-requested. Legal changes
   require counsel approval.

## Commit / signing

- All commits must be signed (`git commit -S`).
- Tags are signed annotated tags created by `tools-v3/v3-release.ps1`.

## Adding a new agent

1. Create `agents/<name>-agent.yml`. Validate against
   [schemas/agent.schema.json](schemas/agent.schema.json) — required
   keys: `name`, `version`, `role`, `owners`, `description`,
   `capabilities`, `inputs`, `outputs`, `error_handling`, `sla`.
2. Reference the agent from
   [agents/master-orchestrator-agent.yml](agents/master-orchestrator-agent.yml)
   (`sub_agents` and a `routing_rules` entry).
3. Add a docs page under `docs/agents/<name>.md`.
4. Add Pester coverage in `tests/agents.tests.ps1` if it has unique
   behaviour.

## Adding a new jurisdiction or rule

1. Create `agents/legal-rules/<code>.yml` (or `us-states/<state>.yml`).
2. Every rule needs `id`, `description`, `severity`, `category`, `when`,
   `then`, and at least one `citations[]` entry.
3. Set `last_reviewed` to today; the daily drift job warns when older
   than 12 months.
4. Update [jurisdictions/index.yml](jurisdictions/index.yml).
5. Add a summary at `docs/legal/<code>.md`.

## Adding a workflow

1. Create `workflows/<name>_workflow.yml` validated against
   [schemas/workflow.schema.json](schemas/workflow.schema.json).
2. Bind it to an intent in
   [metadata/intents.yml](metadata/intents.yml).
3. Add to the `workflowMap` in
   [agents/business-agent.yml](agents/business-agent.yml).
4. Cover with a Pester case in `tests/simulation.tests.ps1`.

## Style

- YAML: 2-space indent, no tabs, no trailing whitespace, no duplicate
  keys (CI enforces).
- PowerShell: `Set-StrictMode -Version Latest`, exit codes from
  `tools/_common.ps1`, every script supports `-Help` and `-WhatIf`.
- Markdown: Sentence-case headings, no inline HTML except `<details>`.
