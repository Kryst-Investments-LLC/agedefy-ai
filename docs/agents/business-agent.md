# business-agent

> **Version:** 1.0.0
> **Role:** Workflow execution, plan-tier gating, tool invocation, persistence
> **Owners:** @kryst-investments-llc/platform

## Description

Executes the workflow selected by the orchestrator, enforces
subscription plan gating, invokes tools, and persists results.


## Capabilities

- load_protocol_template
- persist_entry
- persist_post
- persist_article
- save_protocol
- create_lab_order
- create_consultation_request
- create_marketplace_order
- update_subscription
- index_paper
- save_trial
- load_lab_panel

## Contract

- Spec: [agents/business-agent.yml](../../agents/business-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
