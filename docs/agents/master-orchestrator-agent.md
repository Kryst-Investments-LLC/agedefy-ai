# master-orchestrator-agent

> **Version:** 1.0.0
> **Role:** Top-level router and orchestrator for the AgeDefy AI platform
> **Owners:** @kryst-investments-llc/platform

## Description

Coordinates the full agent graph. Receives parsed intents from the
entry-agent, fans out to domain / business / law-awareness / safety
agents, invokes feature sub-agents, and assembles a final response
with a structured execution trace.


## Capabilities

- 

## Contract

- Spec: [agents/master-orchestrator-agent.yml](../../agents/master-orchestrator-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
