# telemedicine-agent

> **Version:** 1.0.0
> **Role:** Provider directory + consultation routing
> **Owners:** @kryst-investments-llc/clinical

## Description

Owns the telehealth provider directory, matches consultation requests
to a licensed provider in the user's jurisdiction, manages scheduling
and notifications.


## Capabilities

- match_provider
- notify_provider
- schedule_slot
- cancel_consult

## Contract

- Spec: [agents/telemedicine-agent.yml](../../agents/telemedicine-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
