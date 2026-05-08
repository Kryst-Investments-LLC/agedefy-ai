# clinician-review-agent

> **Version:** 1.0.0
> **Role:** Human-in-the-loop escalation queue
> **Owners:** @kryst-investments-llc/clinical

## Description

Routes high-risk actions, ambiguous AI outputs, and flagged community
posts to a licensed clinician for review before they reach the user.


## Capabilities

- enqueue_if_high_risk
- enqueue_if_medical_claim
- assign_clinician
- track_sla
- notify_clinician
- close_review

## Contract

- Spec: [agents/clinician-review-agent.yml](../../agents/clinician-review-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
