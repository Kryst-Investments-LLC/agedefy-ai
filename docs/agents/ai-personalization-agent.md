# ai-personalization-agent

> **Version:** 1.0.0
> **Role:** Multi-provider AI routing with safety + cost + latency optimization
> **Owners:** @kryst-investments-llc/ai

## Description

Routes generation requests across OpenAI / Anthropic / Grok with
model selection by intent, cost, and latency. Owns prompt templates,
PII redaction hand-off, and provider failover.


## Capabilities

- select_provider
- generate_completion
- tailor_to_biomarkers
- explain_with_context
- rerank_for_user

## Contract

- Spec: [agents/ai-personalization-agent.yml](../../agents/ai-personalization-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
