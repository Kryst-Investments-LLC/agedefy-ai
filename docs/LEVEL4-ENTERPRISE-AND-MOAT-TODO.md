# Level 4 Enterprise And Moat TODO

## Operating Mandate

Biozephyra must stop behaving like an app with AI features and start behaving like a longevity intelligence and execution infrastructure company.

That means the platform must do four things simultaneously:

1. Operate safely under enterprise production expectations.
2. Produce proprietary longitudinal intelligence assets.
3. Own the workflow loop from discovery to validation to capital deployment.
4. Compound trust, network density, and economic memory faster than competitors can copy UX.

## Phase 1: Level-4 Hardening First

### 1. PostgreSQL And Data Posture

- [ ] Promote PostgreSQL to the primary operational database.
- [ ] Replace SQLite-first production assumptions in docs, scripts, and CI.
- [x] Introduce migration discipline with rollback and forward-only promotion guidance.
- [ ] Add backup, restore, and disaster recovery runbooks.
- [ ] Add data retention, purge, and legal-hold policy implementation.
- [ ] Add partitioning and indexing strategy for audit, event, and longitudinal outcome tables.

### 2. Distributed Controls

- [x] Replace in-memory rate limiting with Redis or equivalent distributed enforcement.
- [ ] Add durable background job orchestration for AI, ingestion, notification, and governance workloads.
- [ ] Add idempotency keys and replay protection to all high-value mutation routes.
- [ ] Add circuit breakers and graceful degradation for external dependencies.
- [ ] Add feature-flag rollout controls for enterprise-only and high-risk capabilities.

Current repo status:
Idempotency and circuit-breaker foundations are implemented and already applied to Stripe checkout, marketplace payment confirmation, and AeonForge prompt submission, but rollout is not yet complete across every high-value mutation route.

### 3. Observability And SRE

- [ ] Add request IDs, trace correlation, and standardized response headers across the platform.
- [ ] Add OpenTelemetry tracing for API routes, Prisma, Stripe, outbox, and AI calls.
- [ ] Add metrics for latency, error rate, AI cost, queue depth, webhook failures, and authorization denials.
- [ ] Add dashboards for product, infra, and governance operations.
- [ ] Add alerting tied to SLOs and incident severity.
- [ ] Add incident response, on-call, and postmortem runbooks.

Current repo status:
Request IDs, tenant-aware request context, and response headers are implemented in the shared request-context layer and applied to governed AI surfaces, but not yet platform-wide.

### 4. Enterprise Identity And Provisioning

- [x] Add enterprise SSO via OIDC or SAML. — `lib/auth.ts` (OIDC provider), `app/api/auth/sso/route.ts`
- [x] Add SCIM provisioning and deprovisioning. — `app/api/scim/v2/` (Users, Groups, ServiceProviderConfig, ResourceTypes), `lib/scim.ts`
- [x] Add MFA policy for privileged roles. — `lib/mfa.ts`, `app/api/account/mfa/`, `proxy.ts` enforcement
- [x] Add session governance controls for enterprise tenants. — `lib/session-governance.ts`, `app/api/account/sessions/`, `app/api/admin/sessions/`
- [x] Add support-safe impersonation with immutable audit trails. — `lib/admin/impersonation.ts`, `app/api/admin/impersonate/route.ts`

### 5. Tenancy And Access Control

- [x] Add Organization and Tenant models.
- [x] Add `tenantId` to 32 data models with `@default("default")` and validation via `deriveTenantContextWithValidation()`.
- [ ] Add tenant-aware RBAC or ABAC policy enforcement.
- [ ] Add private enterprise research cloud isolation modes.
- [ ] Add tenant quotas, billing scopes, and usage attribution.
- [ ] Add export, audit, and retention policies at tenant scope.

Current repo status:
Tenant resolution is threaded into auth/session, request context, audit, AI governance, and event context. All 32 major data models carry `tenantId`. Cross-tenant leakage tests pass (`tenant-header-validation.test.ts`, `tenant-isolation.test.ts`). Product-surface RBAC enforcement still uses per-route role checks rather than a shared policy engine.

### 6. AI Governance

- [ ] Add governed AI request wrappers for every AI route.
- [x] Add AI audit events: actor, provider, model, request ID, route, cost, and outcome.
- [x] Add model allowlists and environment-controlled release policies.
- [ ] Add prompt, model, and policy version tracking.
- [ ] Add high-risk query classification and human-review escalation.
- [ ] Add citation, uncertainty, and provenance requirements for research outputs.
- [ ] Add evaluation harnesses for model quality, safety, and regression detection.

Current repo status:
Governed wrappers are in place for the main provider AI routes, but not yet for every AI and agent execution surface in the repo.

## Phase 2: Five Compounding Moats

### Data Moat

- [x] Build a proprietary longitudinal biomarker-outcome-intervention graph. — `lib/graph/longitudinal-graph.ts` (10 domains), `TimelineEntry` Prisma model
- [x] Capture interventions, context, biomarkers, follow-up windows, and observed outcomes. — canonical health event system
- [x] Add cohort, protocol, supplement, diagnostic, and telemedicine linkage into one graph. — unified timeline
- [ ] Add causal-ish analysis layers for outcome confidence, confounders, and reproducibility strength.
- [ ] Add proprietary benchmarking views that competitors cannot reconstruct from public data.

### Workflow Moat

- [x] Unify discover, evaluate, procure, fund, test, intervene, monitor, validate, and iterate. — `lib/loop/feedback-loop.ts` (7-stage pipeline with DB persistence)
- [ ] Add cross-module orchestration between research, marketplace, telemedicine, biomarkers, and marketplace funding.
- [x] Add persistent mission-control workspaces for users, clinicians, and enterprise operators. — `lib/loop/mission-control.ts`, `app/api/mission-control/route.ts`
- [ ] Add closed-loop execution plans with reminders, evidence requests, and milestone reviews.

### Trust Moat

- [x] Add provenance and confidence metadata everywhere claims appear. — `lib/graph/provenance.ts`
- [x] Add review, reproducibility, and uncertainty surfaces to all high-impact outputs. — `lib/trust/reproducibility.ts`, `app/api/trust/replications/route.ts`
- [x] Add reviewer workflows for scientific, clinical, and marketplace claims. — `lib/graph/reviewer-workflow.ts`, `app/api/graph/reviews/route.ts`
- [x] Add vendor and intervention trust scores driven by evidence quality and outcomes. — `lib/trust/trust-engine.ts` with DB persistence to `TrustScore` model

### Network Moat

- [ ] Expand scientist-sponsor marketplace into a validated liquidity network.
- [ ] Add reviewer reputation, sponsor quality, scientist credibility, and vendor trust layers.
- [ ] Add private tenant marketplace modes for enterprise customers.
- [ ] Add discovery-to-funding-to-validation loops that get stronger with every participant.

### Capital Moat

- [x] Add capital allocation workflows tied to evidence milestones and validation quality. — `app/api/trust/portfolio/route.ts`
- [ ] Add outcome-indexed contracts and escrow rules.
- [x] Add replication funding primitives through the scientist-sponsor marketplace. — `lib/trust/reproducibility.ts`, `app/api/trust/replications/route.ts`
- [x] Add portfolio views for sponsors tracking outcome-adjusted capital deployment. — `app/api/trust/portfolio/route.ts`

## Phase 3: Outside-The-Box Moats

### Evidence Graph With Economic Memory

- [ ] Accumulate trust, replication, reviewer, and commercial scores for every claim, molecule, protocol, and supplier.
- [ ] Expose longitudinal reputational memory across research and commerce workflows.

### Personal Bioeconomic Ledger

- [ ] Add opt-in consented data cooperative participation.
- [ ] Track user contribution value into model improvement and network intelligence.
- [ ] Design premium access, rebates, or value-share mechanics around data contribution.

### Reproducibility Exchange

- [ ] Add replication funding, replication requests, and public reproducibility indexes.
- [ ] Make reproducibility visible at molecule, protocol, biomarker, and vendor level.

### Autonomous Longevity Mission Control

- [ ] Add persistent agent workflows that monitor biomarkers, literature, adverse signals, suppliers, and trials.
- [ ] Add escalation rules, summary digests, and operator handoff channels.

### Digital Twin Benchmark Corpus

- [ ] Build paired intervention and longitudinal response datasets for twin calibration.
- [ ] Add outcome-quality scoring and benchmark sets for twin evaluation.

### Trust Infrastructure For Supply

- [ ] Add lot traceability, third-party assay proofs, provenance records, and adverse-event linkage.
- [ ] Add post-purchase outcome monitoring tied to products and vendors.

### Private Enterprise Research Clouds

- [ ] Add isolated tenant environments with custom copilots, policy packs, evidence graphs, and marketplace controls.

### Outcome-Indexed Contracts

- [ ] Release sponsor capital against evidence milestones, assay validation, replication evidence, or cohort outcomes.
- [ ] Add dispute, review, and rollback governance for outcome-linked contracts.

## Initial Implementation Tranche Started In Repo

- [x] Create a shared enterprise and moat backlog document.
- [x] Add enterprise hardening environment scaffolding for observability, distributed controls, SSO, tenancy, and AI governance.
- [x] Add request-context observability helpers for request IDs and response headers.
- [x] Add initial AI governance helpers for model allowlists, actor requirements, and audit metadata.
- [x] Start applying governed AI route behavior to provider routes.
- [ ] Extend the same governed pattern to all remaining AI and agent execution surfaces.