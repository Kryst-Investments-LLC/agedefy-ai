# India (`in`)

> **Last reviewed:** 2026-04-01
> **Source:** [agents/legal-rules/in.yml](../../agents/legal-rules/in.yml)

## Active rules

| ID | Severity | Category | Description | Citations |
|----|----------|----------|-------------|-----------|
| `in.dpdp.consent_for_health_data` | critical | biomarker_privacy | Digital Personal Data Protection Act 2023 requires free, specific,
informed consent before processing personal data.
 | System.Collections.Hashtable |
| `in.fssai.nutraceutical_compliance` | high | supplement_legality | Nutraceuticals/health supplements must comply with FSSAI
Nutraceutical Regulations 2022.
 | System.Collections.Hashtable |
| `in.cdsco.prescription_only` | critical | prescription_compliance | Prescription drugs may not be supplied without a registered prescription. | System.Collections.Hashtable |
| `in.telemedicine.bmpg_2020` | high | clinician_licensing | Telemedicine Practice Guidelines 2020 govern clinician–patient consults. | System.Collections.Hashtable |

## Decision flow

The [law-awareness-agent](../agents/law-awareness-agent.md) loads this
file when the user's jurisdiction resolves to `in` and applies each
rule's `when` / `then` contract.

## Drift policy

If `last_reviewed` is older than 365 days, the daily `drift.yml`
workflow opens a tracking issue.
