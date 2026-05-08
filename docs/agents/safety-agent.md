# safety-agent

> **Version:** 1.0.0
> **Role:** Drug / supplement / peptide interaction & contraindication safety net
> **Owners:** @kryst-investments-llc/safety, @kryst-investments-llc/clinical

## Description

Validates compound stacks, AI recommendations, and marketplace orders
against an interaction graph and contraindication rules. Prevents the
platform from suggesting or selling combinations known to be unsafe.


## Capabilities

- check_compound_interactions
- check_drug_supplement_interactions
- scan_for_unsafe_advice
- scan_response
- flag_pregnancy_contraindications
- flag_pediatric_contraindications

## Contract

- Spec: [agents/safety-agent.yml](../../agents/safety-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
