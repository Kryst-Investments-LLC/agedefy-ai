# domain-agent

> **Version:** 1.0.0
> **Role:** Longevity-medicine domain reasoning
> **Owners:** @kryst-investments-llc/platform

## Description

Applies longevity-medicine reasoning over biomarkers, pathways,
compounds, and risk markers. Acts as the first specialist invoked by
the orchestrator for health-context intents.


## Capabilities

- map_biomarkers_to_domains
- detect_risk_markers
- interpret_age_related_signals
- link_pathways_to_compounds

## Contract

- Spec: [agents/domain-agent.yml](../../agents/domain-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
