# Open-Source Legal-Rules Charter (Tier 4.4)

## Strategic intent

Counter-intuitively open-source `agents/legal-rules/**` under the **MIT License**
to make AgeDefy the de-facto longevity compliance standard worldwide.

Reasoning:

- The **rules themselves** are a commodity (every jurisdiction's law is public).
- The **proprietary moat** is everything else:
  - Reasoning engine that applies them to a recommendation envelope
  - Verifiable Credential signing chain (Tier 2.4)
  - Federated cohort dataset (Tier 2.1)
  - Causal sidecar + digital twin (Tier 1.3, 2.3)
  - Compliance Cloud B2B SKU (Tier 2.2) — consumes the rules but adds
    the workflow, support, SLA, indemnification
- Open-sourcing turns every jurisdictional expert in the world into an
  **unpaid contributor maintaining our moat** (Linus's Law applied to law).

## What gets open-sourced

- `agents/legal-rules/*.yml`               (per-jurisdiction rule sets)
- `tools/validate-legal-rules.ps1`         (validator)
- `schemas/legal-rule.v1.json`             (schema)
- `tools/diff-jurisdictions.ps1`           (rule-set diff)

## What stays proprietary

- The `regulatory-passport-agent` reasoning chain
- The `law-awareness-agent` runtime
- All Compliance Cloud B2B billing / SLA / indemnification
- The federated dataset
- The causal sidecar + digital twin
- The W3C VC signing keys + DID infrastructure
- The clinician network partnerships
- AgeDefy product UX

## Repository plan

- New repo: `Kryst-Investments-LLC/longevity-legal-rules` (public, MIT)
- AgeDefy main repo consumes it as a git-submodule OR as an npm package
  `@longevity-standards/legal-rules` published from that repo's CI.
- Versioning: SemVer; rule set version embedded in every VC issued by
  `audit-governance-agent` so even after a rule changes, prior
  recommendations remain auditable to the rule version that produced them.

## Governance model

- **BDFL phase (months 0–6)**: AgeDefy legal team accepts PRs.
- **Steering committee (months 6–18)**: Invite 1 representative per
  major jurisdiction (US/EU/UK/BR/AU/CA/IN/JP).
- **Foundation (month 18+)**: Move to a neutral foundation
  (e.g. Linux Foundation Health). AgeDefy retains a permanent board seat
  and the trademark.

## Marketing posture

- Launch blog post: "Why we open-sourced our biggest moat"
- Conference talk track: GitNation, KubeCon, HLTH, JPM Healthcare
- Inbound channel for Compliance Cloud B2B: every consumer of the
  open repo is a sales lead

## Success metrics

| Metric | 6mo target | 18mo target |
|---|---|---|
| External contributors | 10 | 100 |
| Jurisdictions covered | 7 (today) | 47 |
| Compliance Cloud paying customers | 5 | 50 |
| Time-to-rule-update after regulation change | <30d | <7d (community-driven) |

## Risk + mitigation

- **Risk**: Competitor uses our rules to build rival product.
- **Mitigation**: They still have to build everything else (reasoning,
  signing, dataset, UX, network) — and we get every law fix they
  contribute back.

- **Risk**: Bad-faith PR injecting wrong rule.
- **Mitigation**: 2-of-3 maintainer approval, every PR validated
  against `tools/validate-legal-rules.ps1` in CI, hash-pinned in
  consumer repos.

## Implementation steps (when ready to execute)

1. Add `LICENSE-MIT` to `agents/legal-rules/`.
2. Spin up `longevity-legal-rules` GitHub org-level repo.
3. Migrate rules with full git history (`git filter-repo`).
4. Publish v1.0.0 to npm under `@longevity-standards/legal-rules`.
5. Replace local rule loading with the package import in
   `law-awareness-agent`.
6. Announce.
