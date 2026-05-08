# United States (`us`)

> **Last reviewed:** 2026-04-01
> **Source:** [agents/legal-rules/us.yml](../../agents/legal-rules/us.yml)

## Active rules

| ID | Severity | Category | Description | Citations |
|----|----------|----------|-------------|-----------|
| `us.hipaa.phi_minimum_necessary` | critical | biomarker_privacy | PHI must only be accessed and disclosed for the minimum necessary
purpose. AI workflows must redact identifiers before sending to
third-party providers unless a BAA is in place.
 | System.Collections.Hashtable |
| `us.fda.dshea_no_disease_claims` | high | supplement_legality | Dietary supplements may not be marketed with claims to diagnose,
cure, mitigate, treat, or prevent disease.
 | System.Collections.Hashtable |
| `us.ftc.material_connection_disclosure` | high | marketing | Endorsements, testimonials, and influencer content must clearly
disclose any material connection.
 | System.Collections.Hashtable |
| `us.telemedicine.state_licensure_required` | critical | clinician_licensing | Clinicians must be licensed in the state where the patient is
physically located at the time of consultation.
 | System.Collections.Hashtable |
| `us.clia.lab_oversight` | high | lab_testing_regulation | Clinical laboratory tests on humans must be performed by a
CLIA-certified facility. Direct-to-consumer test marketing must
disclose interpretive limitations.
 | System.Collections.Hashtable |
| `us.dea.controlled_substance_block` | critical | prescription_compliance | Controlled substances (Schedules I–V) cannot be sold via the
marketplace and require DEA-registered prescribers via telehealth.
 | System.Collections.Hashtable |

## Decision flow

The [law-awareness-agent](../agents/law-awareness-agent.md) loads this
file when the user's jurisdiction resolves to `us` and applies each
rule's `when` / `then` contract.

## Drift policy

If `last_reviewed` is older than 365 days, the daily `drift.yml`
workflow opens a tracking issue.
