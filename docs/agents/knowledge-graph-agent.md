# knowledge-graph-agent

> **Version:** 1.0.0
> **Role:** Pathway / compound / interaction / effect graph
> **Owners:** @kryst-investments-llc/research

## Description

Owns the knowledge graph derived from metadata/* and ingested papers.
Powers the compound mixer, pathway pages, and global search.


## Capabilities

- traverse_graph
- load_interactions
- fetch_trend
- search_all_indexes
- link_to_compounds

## Contract

- Spec: [agents/knowledge-graph-agent.yml](../../agents/knowledge-graph-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
