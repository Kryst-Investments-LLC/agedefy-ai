# Brazil (`br`)

> **Last reviewed:** 2026-04-01
> **Source:** [agents/legal-rules/br.yml](../../agents/legal-rules/br.yml)

## Active rules

| ID | Severity | Category | Description | Citations |
|----|----------|----------|-------------|-----------|
| `br.lgpd.sensitive_data_consent` | critical | biomarker_privacy | Health data is sensitive personal data; explicit consent required. | System.Collections.Hashtable |
| `br.anvisa.food_supplement_regulation` | high | supplement_legality | Food supplements must comply with ANVISA RDC 243/2018. | System.Collections.Hashtable |
| `br.cfm.telemedicine_resolution` | critical | clinician_licensing | Telemedicine governed by CFM Resolution 2.314/2022. | System.Collections.Hashtable |

## Decision flow

The [law-awareness-agent](../agents/law-awareness-agent.md) loads this
file when the user's jurisdiction resolves to `br` and applies each
rule's `when` / `then` contract.

## Drift policy

If `last_reviewed` is older than 365 days, the daily `drift.yml`
workflow opens a tracking issue.
