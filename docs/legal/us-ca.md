# California (USA) (`us-ca`)

> **Last reviewed:** 2026-04-01
> **Source:** [agents/legal-rules/ca.yml](../../agents/legal-rules/ca.yml)

## Active rules

| ID | Severity | Category | Description | Citations |
|----|----------|----------|-------------|-----------|
| `us-ca.cpra.health_data_notice` | critical | biomarker_privacy | Sensitive personal information (incl. health data) requires a
separate notice + opt-out under CPRA.
 | System.Collections.Hashtable |
| `us-ca.dtc_lab_disclosure` | high | lab_testing_regulation | California requires direct-to-consumer lab tests to disclose that
the result is not a medical diagnosis.
 | System.Collections.Hashtable |

## Decision flow

The [law-awareness-agent](../agents/law-awareness-agent.md) loads this
file when the user's jurisdiction resolves to `us-ca` and applies each
rule's `when` / `then` contract.

## Drift policy

If `last_reviewed` is older than 365 days, the daily `drift.yml`
workflow opens a tracking issue.
