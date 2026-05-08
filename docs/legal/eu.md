# European Union (`eu`)

> **Last reviewed:** 2026-04-01
> **Source:** [agents/legal-rules/eu.yml](../../agents/legal-rules/eu.yml)

## Active rules

| ID | Severity | Category | Description | Citations |
|----|----------|----------|-------------|-----------|
| `eu.gdpr.lawful_basis_health_data` | critical | biomarker_privacy | Processing of health data (special category) requires explicit
consent or another Article 9 lawful basis.
 | System.Collections.Hashtable |
| `eu.gdpr.data_subject_rights` | high | data_governance | Subjects have rights of access, rectification, erasure, restriction,
portability, and objection — fulfilled within one month.
 | System.Collections.Hashtable |
| `eu.health_claims.authorisation_required` | high | supplement_legality | Health claims on foods/supplements must appear on the EU register
of authorised claims.
 | System.Collections.Hashtable |
| `eu.mdr.software_as_medical_device` | critical | medical_device_rules | Software intended for diagnosis, prevention, or monitoring of disease
can qualify as a medical device under MDR and requires CE marking.
 | System.Collections.Hashtable |
| `eu.ai_act.high_risk_health` | high | ai_governance | AI systems used in health contexts may qualify as high-risk under
the EU AI Act and require risk management, transparency, and
human oversight.
 | System.Collections.Hashtable |

## Decision flow

The [law-awareness-agent](../agents/law-awareness-agent.md) loads this
file when the user's jurisdiction resolves to `eu` and applies each
rule's `when` / `then` contract.

## Drift policy

If `last_reviewed` is older than 365 days, the daily `drift.yml`
workflow opens a tracking issue.
