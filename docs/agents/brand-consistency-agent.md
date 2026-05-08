# brand-consistency-agent

> **Version:** 1.0.0
> **Role:** Brand voice / naming / messaging enforcement
> **Owners:** @kryst-investments-llc/brand

## Description

Ensures tone, naming, visuals, and messaging align with the AgeDefy product brand.


## Capabilities

- Tone and voice review
- Naming consistency
- Messaging alignment
- Visual identity guidance (descriptive)

## Contract

- Spec: [agents/brand-consistency-agent.yml](../../agents/brand-consistency-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
