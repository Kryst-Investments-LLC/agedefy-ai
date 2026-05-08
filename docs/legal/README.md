# Legal rules — jurisdiction reference

Each page summarises the active rules per jurisdiction. The
machine-readable source of truth is in
[`agents/legal-rules/`](../../agents/legal-rules/) and the master
mapping is [`jurisdictions/index.yml`](../../jurisdictions/index.yml).

Rules carry `last_reviewed` (≤ 365 days), severity, citations, and a
`when` / `then` decision contract enforced by the
[law-awareness-agent](../agents/law-awareness-agent.md).

## Countries

| Code | Authority highlights |
|---|---|
| [us](us.md) | HIPAA, FDA DSHEA, FTC, CLIA, FSMB |
| [eu](eu.md) | GDPR, EU AI Act, EMA, CE-mark MDR |
| [uk](uk.md) | UK GDPR, MHRA, CAP Code, GMC |
| [ca](ca.md) | PIPEDA, Health Canada NHPD, CFPC |
| [au](au.md) | TGA, AHPRA, Privacy Act, Australian Consumer Law |
| [br](br.md) | LGPD, ANVISA, CFM |
| [in](in.md) | DPDP Act 2023, FSSAI, CDSCO, NMC |

## US states

| Code | Authority highlights |
|---|---|
| [us-ca](us-ca.md) | CCPA / CPRA, CA telehealth |
| [us-ny](us-ny.md) | NY SHIELD Act, NY telehealth |
| [us-tx](us-tx.md) | TX TDPSA, TX telehealth |
| [us-fl](us-fl.md) | FL FIPA, FL telehealth |

## Decisions

| Decision | Meaning |
|---|---|
| `allow` | Operation proceeds. |
| `warn`  | Operation proceeds with disclaimer or extra logging. |
| `redact`| Operation proceeds, but PII / PHI is masked in output. |
| `block` | Operation halted; user receives policy explanation. |

## Drift management

A daily `drift.yml` workflow runs
[`tools-v3/v3-jurisdiction-validator.ps1`](../../tools-v3/v3-jurisdiction-validator.ps1)
and opens an issue from
[`.github/ISSUE_TEMPLATE/legal-drift.md`](../../.github/ISSUE_TEMPLATE/legal-drift.md)
when any rule's `last_reviewed` date passes 365 days.
