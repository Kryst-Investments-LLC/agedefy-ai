# Florida (USA) (`us-fl`)

> **Last reviewed:** 2026-04-01
> **Source:** [agents/legal-rules/fl.yml](../../agents/legal-rules/fl.yml)

## Active rules

| ID | Severity | Category | Description | Citations |
|----|----------|----------|-------------|-----------|
| `us-fl.fipa.breach_notification` | high | biomarker_privacy | Florida Information Protection Act mandates breach notification
within 30 days for personal information including health data.
 | System.Collections.Hashtable |
| `us-fl.telehealth.registration` | critical | clinician_licensing | Out-of-state providers must register with FL DOH for telehealth. | System.Collections.Hashtable |

## Decision flow

The [law-awareness-agent](../agents/law-awareness-agent.md) loads this
file when the user's jurisdiction resolves to `us-fl` and applies each
rule's `when` / `then` contract.

## Drift policy

If `last_reviewed` is older than 365 days, the daily `drift.yml`
workflow opens a tracking issue.
