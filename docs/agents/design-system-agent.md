# design-system-agent

> **Version:** 1.0.0
> **Role:** Design-system enforcement
> **Owners:** @kryst-investments-llc/design

## Description

Enforces consistent components, spacing, typography, and tokens across the platform.


## Capabilities

- Component API review
- Spacing and layout scale enforcement
- Typography hierarchy review
- Token usage guidance

## Contract

- Spec: [agents/design-system-agent.yml](../../agents/design-system-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
