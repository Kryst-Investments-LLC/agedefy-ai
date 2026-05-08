# observability-agent

> **Version:** 1.0.0
> **Role:** Trace, metric, and log emission across the agent graph
> **Owners:** @kryst-investments-llc/platform

## Description

Emits structured JSON Lines traces (per schemas/trace.schema.json),
Prometheus textfile metrics, and forwards to the audit log when an
event is also a compliance event.


## Capabilities

- emit_trace
- emit_metric
- forward_audit
- sample
- redact_pii_in_trace

## Contract

- Spec: [agents/observability-agent.yml](../../agents/observability-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
