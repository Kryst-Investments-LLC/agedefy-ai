# i18n-agent

> **Version:** 1.0.0
> **Role:** Locale resolution + translation lookup
> **Owners:** @kryst-investments-llc/platform

## Description

Resolves the user's locale (BCP-47), loads the translation bundle,
and returns translated strings for the requested keys. Mirrors the
10-locale scaffold of the product layer.


## Capabilities

- resolve_locale
- load_translations
- fallback_to_default

## Contract

- Spec: [agents/i18n-agent.yml](../../agents/i18n-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
