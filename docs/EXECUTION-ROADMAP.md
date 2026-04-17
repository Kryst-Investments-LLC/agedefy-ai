# Biozephyra Execution Roadmap

## Related Roadmaps

- [Phase 6: Scientist-Sponsor Marketplace Roadmap](phase-6-scientist-sponsor-marketplace-roadmap.md)

## Phase 0: Stabilize and Establish Truth

| Rank | Workstream | Owner | Effort | Outcome |
|---|---|---|---|---|
| 1 | Platform architecture | Staff full-stack engineer | 1 week | Prisma, auth, protected routes, env validation |
| 2 | Delivery quality gates | Staff frontend engineer | 1 week | Type-safe build, linting, CI, deployment checks |
| 3 | Security baseline | Security engineer | 1 week | Secrets policy, auth hardening, audit logging plan |
| 4 | Product truthfulness | Product + engineering | 1 week | Mock claims removed, empty states replaced with real states |

## Phase 1: Core SaaS Foundation

| Rank | Workstream | Owner | Effort | Outcome |
|---|---|---|---|---|
| 1 | Identity and RBAC | Platform engineer | 2 weeks | User, admin, clinician, researcher roles |
| 2 | Billing and entitlements | Product engineer | 2 weeks | Real plans, invoices, subscription state |
| 3 | Admin console | Full-stack engineer | 2 weeks | User support, feature flags, audit reviews |
| 4 | Observability | Platform/SRE | 1 week | Logs, metrics, traces, incident hooks |
| 5 | Consent and privacy | Security + legal + engineer | 2 weeks | Versioned consent, export/delete workflows |

## Phase 2: Scientific Intelligence Platform

| Rank | Workstream | Owner | Effort | Outcome |
|---|---|---|---|---|
| 1 | Evidence ingestion | Data engineer | 3 weeks | PubMed, ClinicalTrials.gov, patent and preprint feeds |
| 2 | Knowledge graph | Applied scientist | 4 weeks | Linked compounds, pathways, biomarkers, studies |
| 3 | Discovery ranking | ML engineer | 3 weeks | Human relevance, safety, novelty, evidence scoring |
| 4 | Protocol intelligence | Clinical product engineer | 3 weeks | Real protocol composer with contraindication rules |
| 5 | Longitudinal outcomes | Backend engineer | 2 weeks | Biomarker and intervention outcome tracking |

## Phase 3: Clinical and Enterprise Expansion

| Rank | Workstream | Owner | Effort | Outcome |
|---|---|---|---|---|
| 1 | Lab and wearable integrations | Integration engineer | 3 weeks | Real device and lab ingestion |
| 2 | Clinician workflows | Clinical PM + engineer | 3 weeks | Scheduling, notes, review queues |
| 3 | Enterprise controls | Enterprise engineer | 3 weeks | SSO, SCIM, tenant isolation, audit export |
| 4 | Compliance program | Security + operations | 6 weeks | SOC 2, HIPAA, GDPR evidence and controls |

## Phase 4: Differentiated Moat

| Rank | Workstream | Owner | Effort | Outcome |
|---|---|---|---|---|
| 1 | Longevity knowledge moat | Head of science + data | Continuous | Proprietary evidence and outcome graph |
| 2 | Digital twin and forecasting | Applied ML | 6 weeks | Biomarker response simulation |
| 3 | Research copilot | Applied AI engineer | 4 weeks | Debate-mode evidence synthesis and actionability |
| 4 | Cohort intelligence | Enterprise analytics engineer | 4 weeks | Program-level insights and benchmarking |

## Phase 6: Scientist-Sponsor Marketplace

The next moat-expansion planning document for commercialization and translational collaboration lives here:

- [Phase 6: Scientist-Sponsor Marketplace Roadmap](phase-6-scientist-sponsor-marketplace-roadmap.md)

## Current Implementation Priority

1. Real authentication and persistent user data
2. Protected dashboard and account surfaces
3. Removal of mock AI fallback paths
4. Honest empty states instead of simulated health claims
5. Database-backed subscriptions, biomarkers, and protocols