# entry-agent

> **Version:** 1.0.0
> **Role:** NLU front door — detect intent, extract slots, normalize locale & jurisdiction
> **Owners:** @kryst-investments-llc/platform

## Description

Receives raw user queries, classifies them against the controlled
intent taxonomy in metadata/intents.yml, extracts domain slots
(biomarkers, compounds, panels, etc.), and emits a normalized request
for the master orchestrator.


## Capabilities

- detect_intent
- extract_biomarker_terms
- extract_compounds
- extract_lab_panel
- normalize_locale
- normalize_jurisdiction_hint
- emit_fallback

## Contract

- Spec: [agents/entry-agent.yml](../../agents/entry-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
