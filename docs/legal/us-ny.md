# New York (USA) (`us-ny`)

> **Last reviewed:** 2026-04-01
> **Source:** [agents/legal-rules/ny.yml](../../agents/legal-rules/ny.yml)

## Active rules

| ID | Severity | Category | Description | Citations |
|----|----------|----------|-------------|-----------|
| `us-ny.shield.security_safeguards` | high | biomarker_privacy | NY SHIELD Act requires reasonable administrative, technical, and
physical safeguards for private information.
 | System.Collections.Hashtable |
| `us-ny.telehealth.parity_documentation` | medium | clinician_licensing | NY telehealth requires informed consent and parity documentation
for reimbursable consults.
 | System.Collections.Hashtable |

## Decision flow

The [law-awareness-agent](../agents/law-awareness-agent.md) loads this
file when the user's jurisdiction resolves to `us-ny` and applies each
rule's `when` / `then` contract.

## Drift policy

If `last_reviewed` is older than 365 days, the daily `drift.yml`
workflow opens a tracking issue.
