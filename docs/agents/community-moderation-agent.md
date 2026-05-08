# community-moderation-agent

> **Version:** 1.0.0
> **Role:** Community forum moderation pipeline
> **Owners:** @kryst-investments-llc/community

## Description

Classifies forum posts, scans for unsafe medical advice, applies the
CAP/FTC marketing rules, and routes flagged content to clinician review.


## Capabilities

- classify_post
- detect_spam
- detect_medical_claim
- escalate_to_clinician_review

## Contract

- Spec: [agents/community-moderation-agent.yml](../../agents/community-moderation-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
