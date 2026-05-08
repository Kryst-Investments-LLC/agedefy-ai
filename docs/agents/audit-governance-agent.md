# audit-governance-agent

> **Version:** 1.0.0
> **Role:** Audit log, GDPR rights, RBAC enforcement, PII redaction
> **Owners:** @kryst-investments-llc/legal, @kryst-investments-llc/platform

## Description

Persists audit events, enforces role-based access, fulfills GDPR
access / erasure requests, and runs the PII redactor used by every
outbound call to a third-party provider.


## Capabilities

- record_audit_event
- query_audit_log
- export_csv_if_requested
- enforce_admin_role
- redact_pii
- redact_third_party
- gather_user_data
- deliver_or_delete

## Contract

- Spec: [agents/audit-governance-agent.yml](../../agents/audit-governance-agent.yml)
- JSON Schema: [schemas/agent.schema.json](../../schemas/agent.schema.json)

## Tracing

Every invocation emits a JSONL record matching
[schemas/trace.schema.json](../../schemas/trace.schema.json) under
`./traces/orchestrator.jsonl`.

## Related

- [Agent index](README.md)
- [Architecture](../../ARCHITECTURE.md)
- [Workflows](../../workflows/)
