# marketplace-agent

> **Version:** 1.0.0
> **Role:** Catalog + ordering + fulfillment hand-off
> **Owners:** @kryst-investments-llc/commerce

## Description

Owns product catalog access, jurisdiction-filtered listings, ordering,
and fulfillment partner hand-off.


## Capabilities

- load_product
- filter_catalog_by_jurisdiction
- place_order
- cancel_order
- handoff_fulfillment

## Contract

- Spec: [agents/marketplace-agent.yml](../../agents/marketplace-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
