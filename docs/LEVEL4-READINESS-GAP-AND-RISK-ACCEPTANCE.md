# Level 4 Readiness Remediation Plan

## Executive Verdict

The repository is still not honestly whole-platform Level 4 ready.

The purpose of this document is no longer just to record gaps. It is the execution plan for closing the highest-risk gaps in a defensible order, with concrete code milestones and release gates.

Until the P0 and P1 gates below are met, the strongest honest public statement remains:

- the codebase has real implementation depth across core product modules
- selected integrations and workflows have been live-verified
- launch-safety hardening is in progress
- whole-platform Level 4 claims are still premature

## What Changed In This Pass

The repository now has concrete P0 foundations for launch safety and verification:

- provider AI routes now return mandatory disclaimer and citation fields via a shared response envelope
- the AI coach UI renders provider disclaimers and citations instead of only free-form text
- user-facing clients calling idempotent mutation routes now attach idempotency keys in the key flows reviewed here
- the strongest compliance-sensitive marketing copy was reduced in metadata and the highest-trust surfaces
- a reusable live smoke harness now exists at `scripts/live-platform-smoke.ts`

These changes improve truthfulness and operational verification, but they do not close the broader reliability, enterprise control, tenancy, or moat gaps that still block a Level 4 claim.

## Release Rule

Do not make a whole-platform Level 4 claim until every P0 item is closed and the P1 reliability controls are materially in place in production configuration.

## Priority Model

- `P0`: launch-safety and truthfulness blockers
- `P1`: reliability, observability, and enterprise-control blockers
- `P2`: enterprise identity, policy, and tenant-governance blockers
- `P3`: compounding moat and closed-loop workflow milestones

## P0: Launch-Safety And Truthfulness

### P0.1 Provider AI response contract

**Goal**

Every provider AI response returned to users must carry explicit disclaimer data and a citations array, even when the upstream model does not comply with the structured prompt.

**Code milestones**

- add the shared schemas in `lib/validators/ai.ts`
- normalize provider outputs in `lib/ai/provider-response.ts`
- enforce the shared envelope in:
	- `app/api/ai/openai/route.ts`
	- `app/api/ai/anthropic/route.ts`
	- `app/api/ai/grok/route.ts`
- render disclaimers and citations in `components/ai-health-coach.tsx`
- cover the response contract in `__tests__/ai-provider-orchestration-routes.test.ts`

**Exit criteria**

- success responses always include `content`, `disclaimer`, `disclaimers`, and `citations`
- citations default to an empty array instead of being omitted
- UI visibly shows the safety framing and any source links returned
- provider route tests pass for OpenAI, Anthropic, and Grok response envelopes

**Status**

Foundation landed in this pass. Keep as `Partial` until validated in repeated live runs and extended to any remaining AI surfaces that bypass the governed provider routes.

### P0.2 Mutation clients must honor idempotency

**Goal**

User-facing clients cannot call routes wrapped by `executeRouteIdempotentJsonMutation` without sending an `idempotency-key`.

**Code milestones**

- add a shared client helper in `lib/client-idempotency.ts`
- patch missing headers in:
	- `components/ai-health-coach.tsx`
	- `app/marketplace/page.tsx`
	- `app/telemedicine/page.tsx`
	- `components/admin-review-console.tsx`
	- `lib/services/ai-service.ts`

**Exit criteria**

- reviewed user-facing mutation flows no longer fail with `Idempotency-Key header is required for this mutation route`
- live smoke coverage exercises those routes successfully

**Status**

First-pass fixes landed in this pass. Keep as `Partial` until the same audit is applied repo-wide to every client-triggered mutation route.

### P0.3 Launch copy must stay within verified scope

**Goal**

Metadata and high-trust pages must stop implying comprehensive coverage, guaranteed safety, or universal evidence review when the repo evidence does not support those claims.

**Code milestones**

- reduce overclaiming metadata in `app/layout.tsx`
- narrow homepage positioning in `app/page.tsx`
- narrow telemedicine framing in `app/telemedicine/page.tsx`
- narrow learning-center review claims in `app/learn/page.tsx`
- narrow discovery-lab enterprise framing in `components/discovery/discovery-lab.tsx`
- narrow protocol template positioning in `components/protocol-templates.tsx`
- narrow AI recommendation framing in:
	- `app/dashboard/page.tsx`
	- `app/personalization/page.tsx`
	- `components/ai-health-coach.tsx`

**Exit criteria**

- no top-level metadata claims “world’s most comprehensive” coverage
- no safety guarantees or implied medical efficacy in launch-facing copy
- AI surfaces describe outputs as informational summaries rather than recommendations or medical advice

**Status**

High-risk first pass landed in this pass. Keep as `Partial` until remaining medium-risk copy is reviewed across marketing, features, and any sales-facing docs.

### P0.4 Live smoke coverage must reflect real product flows

**Goal**

The repo needs a reusable live smoke harness that proves the core user and operator flows actually execute against a running app and real local state.

**Code milestones**

- add `scripts/live-platform-smoke.ts`
- add `pnpm smoke:platform`
- cover these flows in one run:
	- dashboard page load
	- biomarker create plus trends read
	- protocol create, template read, template adoption, and delete
	- marketplace page load, product list, order create, order list, and cancel
	- telemedicine page load, provider list, consultation create, schedule, start, complete, and member readback
	- admin page load, review-item create/update, jobs summary, job enqueue, list, and cancel

**Exit criteria**

- the smoke script passes against a running local app without manual DB seeding assumptions
- the harness creates its own tenant-scoped users and reference data
- failures are actionable and route-specific instead of generic browser-level failures

**Status**

Foundation landed in this pass. CI now runs a Postgres-backed smoke job and the repo includes a scheduled staging validation workflow. Keep as `Partial` until the staging run is enabled with real secrets and reviewed over repeated executions.

## P1: Reliability, Observability, And Enterprise Control

### P1.1 Promote PostgreSQL to the real operating baseline

**Goal**

Remove the SQLite-first posture from readiness claims and production assumptions.

**Code milestones**

- make Postgres the default production target in docs, deployment guidance, and validation workflows
- validate Prisma generation, migration, and deploy paths against Postgres in CI
- stop describing SQLite as the default production-shaped operating posture

**Exit criteria**

- production instructions are Postgres-first
- validation runs include a Postgres-backed path
- README and deployment docs stop implying SQLite is acceptable for Level 4 operations

**Status**

Raised to `Partial`. The runtime build path now generates a Postgres client, CI includes a Postgres-backed smoke job, release automation uses `pnpm db:deploy:postgres`, and the repo now contains a committed `prisma/migrations-postgres` baseline. Keep open until the same posture is exercised repeatedly in shared environments.

### P1.2 Replace optional distributed controls with required production controls

**Goal**

Redis, durable jobs, idempotency, circuit breakers, and request correlation need to be treated as required production controls instead of partial frameworks.

**Code milestones**

- require Redis-backed rate limiting in production environments
- finish idempotency rollout across every high-value mutation route
- complete circuit-breaker rollout across external dependencies
- complete request ID and standardized response header rollout across platform APIs
- close the remaining backlog around durable orchestration for AI, ingestion, notification, and governance paths

**Exit criteria**

- no critical production path silently falls back to single-process controls
- all high-value mutations have replay protection
- external dependency failures degrade predictably and observably

**Status**

Raised to `Partial`. Enforced runtimes now fail fast when Redis-backed rate limiting is missing, and `/api/health` exposes the active rate-limit backend and baseline issues. Keep open until idempotency, request-correlation, and circuit-breaker rollout are complete across the remaining surfaces.

### P1.3 Add real observability and response operations

**Goal**

Level 4 claims require operational visibility, not just app code.

**Code milestones**

- wire OpenTelemetry through API routes, Prisma, AI calls, Stripe, and job execution
- add metrics for latency, error rate, queue depth, AI cost, webhook failures, and auth denials
- define dashboards for product, infra, and governance operations
- add alerting tied to SLOs and incident severity
- add incident, on-call, backup, restore, and disaster-recovery runbooks

**Exit criteria**

- production operators can detect, triage, and recover from degradation without code spelunking
- the repo includes operational docs that match the live architecture

**Status**

Raised to `Partial`. The repo now has an operational runbook, a runtime baseline validator, and `/api/health` readiness data for observability configuration. Keep open until real telemetry instrumentation, dashboards, and alerting are implemented.

### P1.4 Close tenant-scoped governance gaps

**Goal**

Tenant and organization primitives exist, but product-surface enforcement is still incomplete.

**Code milestones**

- complete tenant-scoped ownership across dashboard, research, marketplace, telemedicine, and admin surfaces
- add a general tenant-aware RBAC or ABAC enforcement layer instead of per-route role checks only
- validate export, audit, and retention behaviors at tenant scope

**Exit criteria**

- cross-tenant leakage checks pass across major product surfaces
- permissions are enforced by shared policy primitives, not ad hoc route conditionals

## P2: Enterprise Identity And Session Governance

### P2.1 Enterprise identity stack

**Code milestones**

- ~~implement enterprise SSO via OIDC or SAML~~ — implemented: `lib/auth.ts` (OIDC provider), `app/api/auth/sso/route.ts`
- ~~add SCIM provisioning and deprovisioning~~ — implemented: `app/api/scim/v2/Users/`, `Groups/`, `ServiceProviderConfig/`, `ResourceTypes/`, `lib/scim.ts`
- ~~add MFA policies for privileged roles~~ — implemented: `lib/mfa.ts`, `app/api/account/mfa/`, `proxy.ts` ADMIN/CLINICIAN enforcement
- ~~add enterprise session-governance controls~~ — implemented: `lib/session-governance.ts`, `app/api/account/sessions/`, `app/api/admin/sessions/`
- ~~add support-safe impersonation with immutable audit trails~~ — implemented: `lib/admin/impersonation.ts`, `app/api/admin/impersonate/route.ts` (30min TTL, admin-only, cannot impersonate admins, read-only, full audit trail)

**Status**: **Complete.** All five milestones implemented with tests (`mfa.test.ts`, `scim.test.ts`, `session-governance.test.ts`, `admin-impersonation.test.ts`).

**Exit criteria**

- privileged access can be centrally managed, enforced, and audited for enterprise tenants — **met**

## P3: Closed-Loop Moat And Network Effects

### P3.1 Unify the data graph across product surfaces

**Code milestones**

- ~~unify biomarkers, protocols, interventions, consultations, marketplace orders, research evidence, and outcomes into one defensible longitudinal graph~~ — implemented: `lib/graph/longitudinal-graph.ts` (10-domain timeline)
- ~~make provenance, uncertainty, and review state visible wherever high-impact claims appear~~ — implemented: `lib/graph/provenance.ts` (5-domain provenance tracking)
- ~~add reviewer workflows that span science, clinical, and marketplace claim domains~~ — implemented: `lib/graph/reviewer-workflow.ts`, `app/api/graph/reviews/route.ts`
- added `TimelineEntry` Prisma model for persistent timeline storage

**Status**: **Complete.** Verified by `p3-unified-platform.test.ts`.

### P3.2 Add trust, reproducibility, and capital-allocation layers

**Code milestones**

- ~~build vendor, reviewer, sponsor, and scientist trust layers grounded in evidence and outcomes~~ — implemented: `lib/trust/trust-engine.ts` (4-role trust scoring with DB persistence to `TrustScore` model)
- ~~add reproducibility and replication funding primitives~~ — implemented: `lib/trust/reproducibility.ts`, `app/api/trust/replications/route.ts`
- ~~add portfolio and capital-allocation views tied to evidence milestones and validation quality~~ — implemented: `app/api/trust/portfolio/route.ts`

**Status**: **Complete.** Trust scores now persist to DB on every computation. `TrustScore` model with `TrustRole` enum (SCIENTIST, SPONSOR, REVIEWER, CLINICIAN). Verified by `trust-engine.test.ts`.

### P3.3 Build the compounding loop

**Code milestones**

- ~~connect discovery, evaluation, procurement, clinical review, intervention tracking, outcome monitoring, and funding into a measurable loop~~ — implemented: `lib/loop/feedback-loop.ts` (7-stage pipeline with DB persistence to `FeedbackLoopSnapshot` model)
- ~~expose persistent mission-control workspaces for users, clinicians, and operators~~ — implemented: `lib/loop/mission-control.ts`, `app/api/mission-control/route.ts`
- ~~make outcome-indexed feedback loops stronger with each validated participant interaction~~ — implemented: `lib/loop/outcome-scoring.ts` (5-dimension outcome scoring)
- added `app/api/loop/snapshot/route.ts` — snapshot API with `?history=true` for longitudinal loop tracking (up to 30 historical snapshots)

**Status**: **Complete.** Feedback loop snapshots persist per-stage conversion rates. Verified by `feedback-loop.test.ts`.

## Current Acceptance Gates

### Minimum gate for safe launch messaging

- P0.1 through P0.4 closed enough to pass repeated local and staging validation
- no launch-facing page claims comprehensive coverage or guaranteed safety
- provider AI surfaces always expose disclaimer metadata and source fields

### Minimum gate for an honest Level 4 readiness statement

- all safe launch messaging gates met
- P1 reliability and observability milestones materially complete in production configuration
- ~~enterprise identity and session controls are no longer backlog placeholders~~ — **met**: SSO (OIDC), SCIM v2, MFA, session governance, admin impersonation all implemented with tests
- ~~tenant enforcement is proven across the major product surfaces~~ — **in progress**: `tenantId` added to 32 models with validation, cross-tenant leakage tests passing, but product-surface RBAC enforcement still incomplete

## Validation Commands

- `pnpm typecheck` — 0 errors
- `pnpm test` — 67 files, 495 tests passing
- `pnpm smoke:platform`

`pnpm smoke:platform` expects a running local app and defaults to `http://127.0.0.1:3101`. Override with `SMOKE_BASE_URL` if needed.

## Honest Current Readiness Statement

Biozephyra has moved from a documentation-only gap assessment to an executable remediation path, and the repo now includes concrete P0 hardening for launch safety. That is meaningful progress, but it is still not the same thing as whole-platform Level 4 readiness.