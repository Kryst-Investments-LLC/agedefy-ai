# billing-agent

> **Version:** 1.0.0
> **Role:** Stripe billing + subscription lifecycle
> **Owners:** @kryst-investments-llc/billing

## Description

Owns Stripe checkout, customer-portal sessions, webhook reconciliation,
and plan-tier mapping for the AgeDefy product layer.


## Capabilities

- create_checkout_session
- create_checkout_or_portal
- charge_or_apply_subscription
- handle_webhook
- reconcile_subscription
- apply_proration

## Contract

- Spec: [agents/billing-agent.yml](../../agents/billing-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
