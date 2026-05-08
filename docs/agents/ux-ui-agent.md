# ux-ui-agent

> **Version:** 1.0.0
> **Role:** UX / UI design reviewer
> **Owners:** @kryst-investments-llc/design

## Description

Platform-specific UX/UI design agent. Provides UX flow review, UI layout critique, accessibility checks, and copy improvements.


## Capabilities

- UX flow review
- UI layout critique
- Accessibility and contrast checks
- Copywriting for UI
- Onboarding and retention suggestions

## Contract

- Spec: [agents/ux-ui-agent.yml](../../agents/ux-ui-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
