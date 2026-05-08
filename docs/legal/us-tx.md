# Texas (USA) (`us-tx`)

> **Last reviewed:** 2026-04-01
> **Source:** [agents/legal-rules/tx.yml](../../agents/legal-rules/tx.yml)

## Active rules

| ID | Severity | Category | Description | Citations |
|----|----------|----------|-------------|-----------|
| `us-tx.tdpsa.consent_for_sensitive_data` | high | biomarker_privacy | Texas Data Privacy and Security Act requires opt-in consent for
processing sensitive data (incl. health information).
 | System.Collections.Hashtable |
| `us-tx.medboard.telemedicine_standards` | critical | clinician_licensing | Texas Medical Board telemedicine rules require clinician to
establish standard of care equivalent to in-person visit.
 | System.Collections.Hashtable |

## Decision flow

The [law-awareness-agent](../agents/law-awareness-agent.md) loads this
file when the user's jurisdiction resolves to `us-tx` and applies each
rule's `when` / `then` contract.

## Drift policy

If `last_reviewed` is older than 365 days, the daily `drift.yml`
workflow opens a tracking issue.
