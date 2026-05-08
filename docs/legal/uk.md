# United Kingdom (`uk`)

> **Last reviewed:** 2026-04-01
> **Source:** [agents/legal-rules/uk.yml](../../agents/legal-rules/uk.yml)

## Active rules

| ID | Severity | Category | Description | Citations |
|----|----------|----------|-------------|-----------|
| `uk.gdpr.health_data_consent` | critical | biomarker_privacy | Explicit consent required to process health data. | System.Collections.Hashtable |
| `uk.mhra.unlicensed_medicines_block` | critical | supplement_legality | Unlicensed medicines may not be supplied to the public. | System.Collections.Hashtable |
| `uk.asa.misleading_health_claims` | high | marketing | Health claims in UK marketing must be substantiated and comply with
the CAP Code.
 | System.Collections.Hashtable |
| `uk.mhra.samd_classification` | high | medical_device_rules | Software providing medical device functions requires MHRA registration. | System.Collections.Hashtable |

## Decision flow

The [law-awareness-agent](../agents/law-awareness-agent.md) loads this
file when the user's jurisdiction resolves to `uk` and applies each
rule's `when` / `then` contract.

## Drift policy

If `last_reviewed` is older than 365 days, the daily `drift.yml`
workflow opens a tracking issue.
