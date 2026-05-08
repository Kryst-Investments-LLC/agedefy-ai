# Canada (`ca`)

> **Last reviewed:** 2026-04-01
> **Source:** [agents/legal-rules/ca.yml](../../agents/legal-rules/ca.yml)

## Active rules

| ID | Severity | Category | Description | Citations |
|----|----------|----------|-------------|-----------|
| `ca.pipeda.consent_for_health_info` | critical | biomarker_privacy | Knowledge and consent required for collection/use of personal health info. | System.Collections.Hashtable |
| `ca.nnhpd.npn_required` | high | supplement_legality | Natural Health Products sold in Canada must carry an NPN/DIN-HM
issued by Health Canada.
 | System.Collections.Hashtable |
| `ca.telehealth.provincial_licence` | critical | clinician_licensing | Clinicians must be licensed by the patient's province. | System.Collections.Hashtable |

## Decision flow

The [law-awareness-agent](../agents/law-awareness-agent.md) loads this
file when the user's jurisdiction resolves to `ca` and applies each
rule's `when` / `then` contract.

## Drift policy

If `last_reviewed` is older than 365 days, the daily `drift.yml`
workflow opens a tracking issue.
