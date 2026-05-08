# Australia (`au`)

> **Last reviewed:** 2026-04-01
> **Source:** [agents/legal-rules/au.yml](../../agents/legal-rules/au.yml)

## Active rules

| ID | Severity | Category | Description | Citations |
|----|----------|----------|-------------|-----------|
| `au.privacy.app11_security` | high | biomarker_privacy | Reasonable steps required to protect personal info. | System.Collections.Hashtable |
| `au.tga.artg_listing_required` | critical | supplement_legality | Therapeutic goods supplied in Australia must be on the ARTG. | System.Collections.Hashtable |
| `au.tga.no_disease_claims_supplements` | high | marketing | Listed supplements may only carry low-risk indications. | System.Collections.Hashtable |
| `au.ahpra.registered_practitioner` | critical | clinician_licensing | Clinicians providing telehealth in AU must be AHPRA-registered. | System.Collections.Hashtable |

## Decision flow

The [law-awareness-agent](../agents/law-awareness-agent.md) loads this
file when the user's jurisdiction resolves to `au` and applies each
rule's `when` / `then` contract.

## Drift policy

If `last_reviewed` is older than 365 days, the daily `drift.yml`
workflow opens a tracking issue.
