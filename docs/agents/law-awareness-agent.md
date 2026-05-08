# law-awareness-agent

> **Version:** 1.0.0
> **Role:** Jurisdiction-specific legal validator
> **Owners:** @kryst-investments-llc/legal, @kryst-investments-llc/platform

## Description

Enforces jurisdiction-specific legal rules for the AgeDefy AI platform.
Detects the user's country/region/state, loads the correct legal framework,
validates workflows, and blocks or warns about actions that violate local law.


## Capabilities

- detect_jurisdiction
- load_legal_rules
- validate_actions
- enforce_compliance
- generate_warnings
- adapt_platform_behavior
- emit_compliance_trace

## Contract

- Spec: [agents/law-awareness-agent.yml](../../agents/law-awareness-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
