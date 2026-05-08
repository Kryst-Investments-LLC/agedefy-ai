# AgeDefy AI — Platform Layer

> **This repository is the AI platform layer** that powers the AgeDefy product
> ([README-product.md](README-product.md) describes the Next.js application
> built on top of it). This layer defines the agents, jurisdiction-aware legal
> rules, controlled domain metadata, declarative workflows, and the tooling
> that validates and operates them.

[![CI](https://github.com/Kryst-Investments-LLC/agedefy-ai/actions/workflows/validate-agents.yml/badge.svg)](.github/workflows/validate-agents.yml)
[![Pester](https://github.com/Kryst-Investments-LLC/agedefy-ai/actions/workflows/pester-tests.yml/badge.svg)](.github/workflows/pester-tests.yml)
[![Simulation](https://github.com/Kryst-Investments-LLC/agedefy-ai/actions/workflows/agent-simulation.yml/badge.svg)](.github/workflows/agent-simulation.yml)

---

## Table of contents

- [Layered architecture](#layered-architecture)
- [Repository layout](#repository-layout)
- [Agent graph](#agent-graph)
- [Workflows](#workflows)
- [Jurisdiction & legal rules](#jurisdiction--legal-rules)
- [Domain metadata](#domain-metadata)
- [Schemas & contracts](#schemas--contracts)
- [Tooling](#tooling)
- [Local development](#local-development)
- [Testing](#testing)
- [Continuous integration](#continuous-integration)
- [Observability](#observability)
- [Release process](#release-process)
- [Governance & security](#governance--security)
- [Contributing](#contributing)
- [License](#license)

---

## Layered architecture

```
+-------------------------------+
|  Enterprise Layer             |  policies, compliance, audit retention
+---------------+---------------+
                |
                v
+-------------------------------+
|  AI Platform Layer (THIS REPO)|  agents, workflows, legal rules, tools
+---------------+---------------+
                |
                v
+-------------------------------+
|  Product Layer                |  Next.js app — see README-product.md
+-------------------------------+
```

Each layer has a single owner and a stable contract. The platform layer
exposes:

1. **Agent specs** (`agents/*.yml`) — declarative capabilities, I/O,
   SLAs, error handling.
2. **Workflows** (`workflows/*.yml`) — ordered steps + agent bindings
   for every product feature.
3. **Legal rules** (`agents/legal-rules/**`) — per-jurisdiction
   constraints with citations.
4. **Domain metadata** (`metadata/*.yml`) — controlled vocabularies for
   compounds, pathways, biomarkers, products, lab panels.
5. **Tooling** (`tools/`, `tools-v3/`) — PowerShell scripts to develop,
   validate, simulate, and release the platform.

---

## Repository layout

```
.
├── agents/                       # Agent specifications
│   ├── master-orchestrator-agent.yml
│   ├── entry-agent.yml
│   ├── domain-agent.yml
│   ├── business-agent.yml
│   ├── law-awareness-agent.yml
│   ├── safety-agent.yml
│   ├── clinician-review-agent.yml
│   ├── ai-personalization-agent.yml
│   ├── telemedicine-agent.yml
│   ├── marketplace-agent.yml
│   ├── billing-agent.yml
│   ├── community-moderation-agent.yml
│   ├── research-agent.yml
│   ├── knowledge-graph-agent.yml
│   ├── observability-agent.yml
│   ├── audit-governance-agent.yml
│   ├── i18n-agent.yml
│   ├── ux-ui-agent.yml
│   ├── design-system-agent.yml
│   ├── brand-consistency-agent.yml
│   └── legal-rules/              # Per-country + us-states/
├── workflows/                    # Declarative workflow specs
├── jurisdictions/                # ISO mapping → legal-rules file
├── metadata/                     # Controlled domain vocabularies
├── schemas/                      # JSON Schemas for every spec
├── tools/                        # Operator scripts (v2)
├── tools-v3/                     # Next-gen tooling (debugger, inspector, …)
├── tests/                        # Pester tests + golden traces + redteam
├── traces/                       # Runtime trace output (gitignored)
├── docs/                         # Long-form docs, agent + legal pages
├── .github/workflows/            # CI pipelines
├── ARCHITECTURE.md
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── SECURITY.md
├── SUPPORT.md
├── version.json
└── README.md  (this file)
```

---

## Agent graph

| Agent | Purpose |
|---|---|
| `entry-agent` | NLU: detect intent, extract slots, normalize locale & jurisdiction hints |
| `master-orchestrator-agent` | Route to domain/business/legal/safety + feature sub-agents |
| `domain-agent` | Longevity-medicine reasoning: biomarker context, healthspan analysis |
| `business-agent` | Workflow execution, plan tier gating, tool invocation |
| `law-awareness-agent` | Per-jurisdiction legal validation (HIPAA, GDPR, MHRA, TGA, …) |
| `safety-agent` | Drug / supplement / peptide interactions and contraindications |
| `clinician-review-agent` | Escalation queue and human-in-the-loop review |
| `ai-personalization-agent` | Multi-provider AI routing (OpenAI / Anthropic / Grok) |
| `telemedicine-agent` | Provider directory, consultation scheduling |
| `marketplace-agent` | Product catalog, ordering, fulfillment hand-off |
| `billing-agent` | Stripe checkout, webhook reconciliation, plan changes |
| `community-moderation-agent` | Forum moderation, report triage |
| `research-agent` | Paper ingestion, clinical-trial search |
| `knowledge-graph-agent` | Pathway / compound / interaction queries |
| `observability-agent` | Trace, metric, and audit emission |
| `audit-governance-agent` | GDPR export/delete, audit log access |
| `i18n-agent` | Locale resolution, translation lookup |
| `ux-ui-agent` / `design-system-agent` / `brand-consistency-agent` | Design QA |

See [docs/agents/](docs/agents/) for one page per agent.

---

## Workflows

Every product module from [README-product.md](README-product.md) has a
matching declarative workflow under [workflows/](workflows/):

| Module | Workflow file |
|---|---|
| Biomarker tracking | [biomarker_interpretation_workflow.yml](workflows/biomarker_interpretation_workflow.yml) |
| Protocol engine | [protocol_recommendation_workflow.yml](workflows/protocol_recommendation_workflow.yml) |
| Knowledge graph / mixer | [compound_interaction_workflow.yml](workflows/compound_interaction_workflow.yml), [knowledge_graph_workflow.yml](workflows/knowledge_graph_workflow.yml) |
| Lab testing | [lab_order_workflow.yml](workflows/lab_order_workflow.yml) |
| Telemedicine | [telemedicine_routing_workflow.yml](workflows/telemedicine_routing_workflow.yml) |
| Marketplace | [marketplace_purchase_workflow.yml](workflows/marketplace_purchase_workflow.yml) |
| Community forum | [community_moderation_workflow.yml](workflows/community_moderation_workflow.yml) |
| Learning center | [learning_content_workflow.yml](workflows/learning_content_workflow.yml) |
| Clinical trials | [clinical_trial_search_workflow.yml](workflows/clinical_trial_search_workflow.yml) |
| Research hub | [research_ingestion_workflow.yml](workflows/research_ingestion_workflow.yml) |
| AI personalization | [ai_personalization_workflow.yml](workflows/ai_personalization_workflow.yml) |
| Global search | [global_search_workflow.yml](workflows/global_search_workflow.yml) |
| Stripe billing | [subscription_billing_workflow.yml](workflows/subscription_billing_workflow.yml) |
| Admin / GDPR | [account_gdpr_workflow.yml](workflows/account_gdpr_workflow.yml), [admin_audit_workflow.yml](workflows/admin_audit_workflow.yml) |
| i18n | [i18n_resolution_workflow.yml](workflows/i18n_resolution_workflow.yml) |

---

## Jurisdiction & legal rules

Per-country rules live in [agents/legal-rules/](agents/legal-rules/) with
US state overlays under `us-states/`. Each rule carries citations and a
`last_reviewed` date; CI warns when a rule has not been reviewed in 365
days.

| Code | Frameworks covered |
|---|---|
| `us` + states | HIPAA, FDA DSHEA, FTC, CLIA, state telehealth, CCPA (CA), SHIELD (NY), TMRC (TX), FIPA (FL) |
| `eu` | GDPR, MDR, Regulation (EC) No 1924/2006 health claims |
| `uk` | UK GDPR, MHRA, ASA CAP code |
| `ca` | PIPEDA, Health Canada NHPD |
| `au` | TGA, Privacy Act |
| `br` | ANVISA, LGPD |
| `in` | CDSCO, DPDP Act, Telemedicine Practice Guidelines |

ISO → file mapping lives in [jurisdictions/index.yml](jurisdictions/index.yml).

---

## Domain metadata

Controlled vocabularies under [metadata/](metadata/):

- [compounds.yml](metadata/compounds.yml)
- [pathways.yml](metadata/pathways.yml)
- [biomarkers.yml](metadata/biomarkers.yml)
- [products.yml](metadata/products.yml)
- [lab_panels.yml](metadata/lab_panels.yml)
- [intents.yml](metadata/intents.yml)

These files are the single source of truth referenced by agents and
workflows. Schema-validated in CI.

---

## Schemas & contracts

[schemas/](schemas/) holds JSON Schemas. Every YAML in this repo is
validated against the matching schema in CI:

| Spec | Schema |
|---|---|
| `agents/*-agent.yml` | [schemas/agent.schema.json](schemas/agent.schema.json) |
| `agents/legal-rules/**/*.yml` | [schemas/legal-rule.schema.json](schemas/legal-rule.schema.json) |
| `workflows/*.yml` | [schemas/workflow.schema.json](schemas/workflow.schema.json) |
| `metadata/intents.yml` | [schemas/intent.schema.json](schemas/intent.schema.json) |
| `traces/*.jsonl` | [schemas/trace.schema.json](schemas/trace.schema.json) |

---

## Tooling

```powershell
# Interactive dev menu
./tools/platform-dev.ps1

# Validate all YAML against schemas
./tools/validate-legal-rules.ps1
./tools-v3/v3-jurisdiction-validator.ps1

# Inspect any agent
./tools-v3/v3-agent-inspector.ps1 -Name domain-agent

# Step through a workflow
./tools-v3/v3-workflow-debugger.ps1 -Workflow biomarker_interpretation_workflow

# Visualize the orchestrator graph
./tools-v3/v3-orchestrator-visualizer.ps1

# Run the test platform multi-target
./tools-v3/v3-multi-platform-test.ps1

# Diff two jurisdictions
./tools-v3/v3-diff.ps1 -A us -B eu

# Cut a release (semver bump + tag)
./tools-v3/v3-release.ps1 -Bump patch
```

All scripts support `-Help`, `-WhatIf`, `-Verbose`, and use standard exit
codes (`0` ok, `1` validation error, `2` runtime error, `3` schema error).

---

## Local development

Prerequisites:

- **PowerShell 7+** (`pwsh`)
- **Node 18+** (only if running `ajv-cli` locally)
- **powershell-yaml** module: `Install-Module powershell-yaml -Scope CurrentUser`

```powershell
git clone https://github.com/Kryst-Investments-LLC/agedefy-ai
cd agedefy-ai
./tools/platform-dev.ps1   # opens the dev menu
```

---

## Testing

Pester suites under [tests/](tests/):

```powershell
Invoke-Pester ./tests -Output Detailed
```

| Suite | Scope |
|---|---|
| `agents.tests.ps1` | Schema, required keys, version, owners, examples |
| `legal-rules.tests.ps1` | Schema, citations, freshness, ISO codes |
| `tools.tests.ps1` | Each script supports `-Help`, sane exit codes |
| `simulation.tests.ps1` | Golden-trace diff for orchestrator runs |
| `redteam/*.tests.ps1` | Jailbreak / jurisdiction-bypass / unsafe advice |
| `eval/*.tests.ps1` | Intent / workflow / jurisdiction accuracy dataset |

Coverage gate: **≥ 80 %** enforced in CI.

---

## Continuous integration

| Workflow | Purpose |
|---|---|
| [validate-agents.yml](.github/workflows/validate-agents.yml) | yamllint + ajv schema validation, dup-key + orphan-file checks |
| [pester-tests.yml](.github/workflows/pester-tests.yml) | Pester suites + coverage gate |
| [agent-simulation.yml](.github/workflows/agent-simulation.yml) | Headless `Test-Platform` + `Run-Simulation` golden diff |
| [lint.yml](.github/workflows/lint.yml) | markdownlint + actionlint |
| [security.yml](.github/workflows/security.yml) | gitleaks + trivy fs |
| [drift.yml](.github/workflows/drift.yml) | Nightly legal-rule freshness check |
| [release.yml](.github/workflows/release.yml) | Tag → SBOM (syft) + provenance (cosign) |

---

## Observability

The orchestrator emits one JSON Lines record per decision to
`./traces/*.jsonl`. Schema in
[schemas/trace.schema.json](schemas/trace.schema.json). Replay any past
trace deterministically with:

```powershell
./tools/replay-trace.ps1 -File ./traces/orchestrator.jsonl -RunId <id>
```

Metrics are exported as Prometheus textfiles by `Run-Simulation`.

---

## Release process

1. `./tools-v3/v3-release.ps1 -Bump <patch|minor|major>` updates
   [version.json](version.json) and creates a signed annotated tag.
2. CI builds an SBOM (`syft`) and signs the release artifacts (`cosign`).
3. Channel promotion: `dev → beta → stable`, gated on green checks.

---

## Governance & security

- [SECURITY.md](SECURITY.md) — disclosure policy, PGP key, supported versions.
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SUPPORT.md](SUPPORT.md)
- `.github/CODEOWNERS` — `legal/*` → counsel; `agents/*` → platform leads.
- `.github/dependabot.yml` — weekly action updates.
- `.pre-commit-config.yaml` — gitleaks, yamllint, markdownlint.
- Signed commits + signed tags required on `main`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions must pass CI
(schemas, pester, simulation, lint, security) and include a CHANGELOG
entry.

---

## License

Private — all rights reserved. © Kryst Investments LLC.
