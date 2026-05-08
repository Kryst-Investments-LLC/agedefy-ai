# research-agent

> **Version:** 1.0.0
> **Role:** Paper ingestion + clinical-trial search
> **Owners:** @kryst-investments-llc/research

## Description

Ingests research papers (PubMed, bioRxiv, DOI), normalizes metadata,
links to compounds + pathways, and powers the clinical-trial search.


## Capabilities

- ingest_paper
- search_external_trials
- dedupe_and_normalize
- link_to_compounds

## Contract

- Spec: [agents/research-agent.yml](../../agents/research-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
