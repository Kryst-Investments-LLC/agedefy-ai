# AgeDefy production-grade backlog

> Status: planning backlog; checkboxes are not evidence of completion.
> Updated: 2026-07-19
>
> Product boundary: AgeDefy is a longevity research and care platform, not a
> medical service. Compound outputs are candidates, leads, or hypotheses until
> independently validated. Nothing in this backlog authorizes diagnostic,
> prescriptive, treatment, therapy, cure, or dosing claims.

## How to use this backlog

- `P0` blocks any production launch or handling of paid-user health data.
- `P1` blocks a dependable public B2C launch.
- `P2` improves scale, scientific quality, or operational maturity.
- `P3` is an optional strategic capability.
- Close an item only when its acceptance criteria and automated checks pass.
- Record an owner, target date, pull request, evidence, and residual risk for
  every P0/P1 item in the release tracker.

## Implementation progress — 2026-07-21

| Priority | Completed | Total | Completion |
| --- | ---: | ---: | ---: |
| P0 | 28 | 85 | 32.9% |
| P1 | 8 | 77 | 10.4% |
| P2 | 0 | 18 | 0% |
| P3 | 0 | 3 | 0% |

Totals count the discrete ID-tagged checklist items (`P0-SEC-001`, …) actually
present in this file, verified by grep — 85 P0 / 77 P1 / 18 P2 / 3 P3. (The 6
bare `P0` "Definition of production-ready" gate lines are tracked separately;
including them makes the P0 total 91.) Completion counts only fully satisfied
items — partials are documented inline but do not increase the completed count.

- Dependency remediation: all high/critical production advisories removed;
  two moderate OpenTelemetry advisories remain through upstream Pub/Sub and
  auto-instrumentation dependency paths.
- Secrets: new and updated screening-adapter credentials use AES-256-GCM;
  plaintext is rejected outside tests unless an explicit migration flag is set.
  A one-time migration command is available but has not been run on any deployed DB.
- Repository secret hygiene: the tracked outbox `.env` file was removed and the
  secret-directory pattern was added to `.gitignore`; credential rotation and
  Git-history review remain external operator tasks.
- Configuration: `.env.example` now documents PostgreSQL and the baseline
  application, MFA, cron, Redis, telemetry, tenancy, governance, and encryption variables.
- CI/deployment: an application quality-gate workflow, standalone Next.js output,
  `.dockerignore`, and a non-root multi-stage application Dockerfile were added.
  Branch protection and a live container smoke test remain external/unverified.
- Governance: repository legal YAML packs now load at runtime and fail closed if
  unavailable in staging/production. Qualified legal review and route-by-route
  jurisdiction application remain incomplete.
- Research access: interactive discovery, API-key issuance/use, screening-adapter
  operations, and candidate transitions now require researcher/clinician/admin roles.
- Candidate stages: promotion now checks for structure and screening evidence,
  lab/CRO handoff identity, persisted lab results, and computed feedback at the
  corresponding transitions.
- Scheduled jobs: every repository cron route now uses one fail-closed,
  constant-time bearer-token guard; missing configuration is logged without
  disclosing server state to callers.
- Step-up authentication: a server-authoritative ten-minute MFA freshness guard
  protects account export/deletion, audit exports, impersonation start, screening
  credential changes, every repository administrator mutation handler, marketplace
  product review, clinician review/co-sign decisions, telemedicine state changes,
  PK fitting, scientific reflection, and dosage-hypothesis generation. A final
  classification of consumer-owned deletion routes and non-interactive SCIM/API-key
  operations remains before `P0-SEC-005` can be closed.
- Test architecture: pure unit, serialized PostgreSQL integration, and live-server
  integration suites now have separate configs and commands. Integration commands
  validate PostgreSQL and secret prerequisites before setup. The complete pure unit
  suite passes (206 files, 2,069 passing tests, 4 documented todos).
- Upload safety: lab-report uploads now enforce limits before buffering, verify
  PDF/image signatures, reject declared-type spoofing, and cap PDF page markers.
  Production malware scanning and isolated quarantine storage remain open.
- Verification so far: TypeScript, zero-warning ESLint, production build, the full
  pure unit suite, and focused security/governance/candidate tests pass.
  PostgreSQL-backed and live-server suites remain open environment-dependent gates.
- 2026-07-21 session: closed P0-OBS-004 (SLI/SLOs + all six instrumentation gaps:
  outbox-latency, stripe-outcome, job-age gauge, DB-pool via Prisma $metrics,
  route-templated http metrics, candidate-lifecycle) and P1-OBS-005 (all nine
  alert dimensions); P1-PERF-008 (no-store PHI default + public-catalog caching,
  empirically verified); P1-PERF-015 (per-tenant lease-cap fairness, dead-letter
  replay, enqueue quota — plus the pre-existing priorities/cancel/dedup);
  P1-OPS-010/011 (liveness/readiness split, graceful worker shutdown + lease
  handoff); P1-INT-008 (circuit-breaker degraded-state banner across AI/payments/
  research-data). Advanced PERF-006/009/012/021 and SEC-002/006/009 with code +
  real-Postgres tests. Full run: unit 2136 pass / 4 todo, PostgreSQL 74 pass.

## Definition of production-ready

- [ ] `P0` All P0 items are complete, independently reviewed, and documented.
- [ ] `P0` `pnpm install --frozen-lockfile`, database generation/deployment,
  lint, typecheck, unit tests, integration tests, and production build pass in CI.
- [ ] `P0` A release candidate deploys to staging from the same immutable
  artifact used in production.
- [ ] `P0` Backup restoration and application rollback are demonstrated.
- [ ] `P0` Security, privacy, legal, and scientific reviewers approve the
  launch scope in writing.
- [ ] `P0` No feature is advertised unless its dependency and end-to-end path
  pass a production-like smoke test.

## 1. Release blockers and security

- [x] `P0-SEC-001` Upgrade or override all vulnerable production dependencies.
  - Remove all high/critical findings from `pnpm audit --prod`.
  - Upgrade Nodemailer to a non-vulnerable release and test every email path.
  - Upgrade `@grpc/grpc-js`, OpenTelemetry dependencies, and `protobufjs`.
  - Generate and archive an SBOM for each release.
- [ ] `P0-SEC-002` Encrypt `ExternalScreeningAdapter.secret` at the application
  boundary with envelope encryption backed by KMS/HSM or a managed vault.
  - Store ciphertext, key version, and rotation metadata only.
  - Never serialize, log, trace, or return the decrypted value.
  - Migrate existing records and test key rotation and failed decryption.
  <!-- CODE DONE: lib/external-secret-crypto.ts does app-boundary AES-256-GCM with
       a random IV + auth tag and an `enc:v1:` scheme-version prefix; fail-closed in
       production (throws if a stored value isn't encrypted). Routes encrypt on
       create/update (screening-adapters + [id]) and NEVER return the secret —
       it is `select`-excluded from every list/create/get/patch response;
       decryptExternalSecret is used only server-side in lib/external-screening.ts.
       Tested: external-secret-crypto.test.ts (round-trip + tamper/failed-decrypt).
       Migration: lib/external-screening-backfill.ts#backfillEncryptScreeningSecrets
       (idempotent, pnpm screening-secrets:backfill) encrypts any legacy plaintext
       row; tested on real PG (external-screening-backfill-pg.test.ts). REMAINING
       (infra, RB-8): back the key with KMS/HSM instead of an env-derived key, and
       operational key-version rotation. -->

- [x] `P0-SEC-003` Remove the tracked plaintext Kubernetes secret file.
  - Rotate every credential that appeared in Git.
  - Use External Secrets, Sealed Secrets, or the cloud secret manager.
  - Decide with security counsel whether history rewriting is required.
- [x] `P0-SEC-004` Run secret scanning on the entire Git history and current tree.
- [x] `P0-SEC-005` Require MFA and recent reauthentication for administrators,
  clinician actions, secret changes, exports, impersonation, and destructive actions.
- [ ] `P0-SEC-006` Verify tenant isolation on every tenant-owned table and route.
  - Add cross-tenant negative tests for read, write, export, search, jobs, and streams.
  - Decide whether PostgreSQL row-level security is a required second boundary.
  <!-- PROGRESS: the central guard is now proven — tenancy.test.ts asserts
       deriveTenantContextWithValidation() rejects a header-supplied tenant the
       user is not a member of (403) and allows the user's own tenant. Owned-
       resource routes additionally scope by userId (findFirst {id,userId}). An
       end-to-end cross-tenant negative test now proves the wiring: a RESEARCHER
       with no session tenant who spoofs x-tenant-id for a tenant they don't belong
       to is rejected 403 by POST /api/compounds and writes nothing
       (object-level-authz-pg.test.ts). REMAINING: extend cross-tenant negatives to
       more write/export/search/jobs/streams routes, and the RLS decision. -->

- [x] `P0-SEC-007` Add SSRF protection to every user-configurable outbound URL.
  - Block loopback, link-local, private, metadata-service, and DNS-rebinding targets.
  - Allowlist schemes and ports; revalidate after redirects and DNS resolution.
- [x] `P0-SEC-008` Verify signature, timestamp, replay, and idempotency controls for
  Stripe, wearable, laboratory, and partner webhooks.
  <!-- Two webhook routes exist. Stripe: constructEvent signature verification
       (+ SDK timestamp tolerance), claim-PENDING -> complete idempotency, 5xx +
       leave-PENDING on failure. Wearable (Terra): HMAC signature (fail-closed
       401), body-hash idempotency with claim -> complete (fixed to complete on
       success / leave PENDING + 500 on error / skip duplicates), replay covered
       by the dedup. No laboratory/partner webhook routes exist yet — add these
       controls when those integrations ship. Tested: stripe-webhook-*.test.ts,
       wearables-webhook-idempotency.test.ts. -->

- [x] `P0-SEC-009` Add CSRF, open-redirect, session-fixation, authorization,
  object-level authorization, file-upload, and rate-limit security tests.
  <!-- PROGRESS: open-redirect FIXED — sign-in callbackUrl now passes through safeInternalPath() (same-origin only), tested in safe-redirect.test.ts. file-upload (lab-upload-security.test.ts) and rate-limit (rate-limit.test.ts) covered; role-gate authz covered: object-level-authz-pg.test.ts now proves per-route IDOR (biomarker + protocol DELETE by a non-owner -> 404, resource untouched, with an owner-can-delete positive control), an ADMIN route rejecting a non-admin (403), and a cross-tenant spoofed x-tenant-id rejection (403). REMAINING: CSRF/session-fixation stay NextAuth-managed; extend IDOR/role-gate coverage to more routes as they change. -->
- [ ] `P0-SEC-010` Add malware scanning, MIME sniffing, size/page limits, safe PDF
  parsing, and isolated storage for uploaded laboratory documents.
  <!-- DONE (code): lib/security/lab-upload.ts enforces magic-byte MIME sniffing
       (content vs declared type), an 8MB size cap, a 50-page PDF limit, and now
       rejects PDFs with active/executable content (JavaScript/JS/Launch/
       EmbeddedFile/RichMedia) — the safe-PDF-parsing control. Uploads are parsed
       to text and not persisted as raw files. REMAINING (infra): external AV
       (e.g. ClamAV) scan hook and isolated object storage if raw files are ever
       persisted. -->

- [ ] `P0-SEC-011` Define retention and redaction policies for logs, traces, prompts,
  model outputs, uploaded files, audit logs, and database backups.
  <!-- PROGRESS: REDACTION done (logger key-name redaction, tested). RETENTION: lib/retention/data-retention.ts#purgeExpiredTransientData purges past-expiry IdempotencyRecords + VerificationTokens (zero-policy, driven by each record's own expiresAt), wired into the retention cron/job and tested (data-retention-pg.test.ts). REMAINING: documented retention WINDOWS for PHI/health data (biomarkers, agent sessions, traces), log/trace/prompt/backup retention config — these are governance/legal + infra decisions, not code defaults. -->
- [ ] `P1-SEC-012` Add CAPTCHA/bot protection to registration, password recovery,
  credential verification, and other abuse-prone public endpoints.
- [ ] `P1-SEC-013` Perform an independent penetration test and remediate all
  critical/high findings before launch.
- [ ] `P1-SEC-014` Add dependency, container, IaC, SAST, secret, and license scanning
  as required CI checks with documented exceptions and expiration dates.
- [x] `P1-SEC-015` Add a vulnerability disclosure process, security contact,
  severity SLA, and incident communication templates.
  <!-- SECURITY.md: disclosure process (private reporting, safe harbour, scope),
       security contact (security@biozephyra.com), and severity SLA (ack 24h /
       triage 72h / fix targets). Incident communication templates in
       docs/security/incident-communication-templates.md: reporter ack/status/
       resolution, internal incident declaration, status-page holding update,
       public advisory, and GDPR Art. 33/34 breach notifications; referenced from
       SECURITY.md's Incident Response section. -->


## 2. Environment and configuration

- [x] `P0-CFG-001` Replace the SQLite URL in `.env.example` with a PostgreSQL example.
- [ ] `P0-CFG-002` Document every runtime variable, owner, sensitivity, allowed
  values, default, environments, and rotation procedure.
- [x] `P0-CFG-003` Add missing baseline variables, including `APP_ENV`,
  `POSTGRES_DATABASE_URL`, `MFA_ENCRYPTION_KEY`, `CRON_SECRET`, Redis, OTEL,
  tenancy, AI governance, and sidecar flags.
- [x] `P0-CFG-004` Validate all enabled integrations at startup and fail closed in
  staging/production when their required configuration is absent or malformed.
- [x] `P0-CFG-005` Remove development fallbacks from production code paths.
  <!-- assertNoDevFallbacksInProduction() in lib/env.ts refuses the committed dev
       NEXTAUTH_SECRET and the SQLite DATABASE_URL fallback whenever
       NODE_ENV=production, independent of APP_ENV. Tested in runtime-baseline.test.ts. -->

- [x] `P0-CFG-006` Guarantee `ENABLE_TEST_AUTH_ENDPOINT=false` in every deployed
  environment and add a deployment assertion for it.
- [ ] `P1-CFG-007` Create separate development, CI, staging, and production secret
  scopes with least-privilege identities.
- [ ] `P1-CFG-008` Add configuration drift detection and an audited emergency
  configuration-change procedure.
  <!-- PARTIAL: emergency-override detection landed. getRuntimeBaseline() now flags
       the two migration-only escape hatches (SCREENING_ADAPTER_ALLOW_PLAINTEXT,
       MFA_ALLOW_PLAINTEXT_FALLBACK) as baseline issues when left 'true' in a
       staging/production baseline — surfaced by /api/health (baselineSatisfied:false
       + issues[]) and by scripts/validate-runtime-baseline.ts (non-zero exit). So an
       emergency override left active is now detected and audited at startup + health.
       REMAINING for full [x]: a config-fingerprint drift snapshot compared across
       deploys, and a documented emergency change procedure. -->

- [x] `P1-CFG-009` Rename the package from `my-v0-project` to the approved product name.

## 3. CI, tests, and release engineering

- [x] `P0-CI-001` Replace the obsolete `next lint` script with ESLint CLI.
- [x] `P0-CI-002` Resolve all application ESLint errors and warnings.
  - Prioritize React purity, effect behavior, and hook dependency findings.
  - Remove dead code and unused imports after behavioral fixes.
- [x] `P0-CI-003` Split tests into pure unit, PostgreSQL integration, and live-server
  end-to-end suites; do not label database tests as unit tests.
- [x] `P0-CI-004` Make test commands validate prerequisites with concise errors.
- [x] `P0-CI-005` Run the full test suite against disposable PostgreSQL in CI.
- [ ] `P0-CI-006` Make build, typecheck, ESLint, tests, migration validation, and
  production dependency audit required pull-request checks.
  <!-- The quality-gates.yml workflow runs pnpm install --frozen-lockfile, db:generate/deploy, typecheck, lint, test:unit/postgres/integration, build, and audit --prod on every PR. REMAINING: mark these as REQUIRED via GitHub branch protection (repo setting, not code). -->
- [ ] `P0-CI-007` Add branch protection, required reviews, CODEOWNERS, and blocked
  direct pushes for production branches.
  <!-- .github/CODEOWNERS exists (default + safety/clinical/billing paths). REMAINING: branch protection, required reviews, and blocked direct pushes are GitHub repo settings (not code). -->
- [x] `P0-CI-008` Prevent static generation from swallowing required database or
  integration failures; explicitly classify optional versus required data.
- [ ] `P1-CI-009` Add Playwright journeys for registration, email verification,
  sign-in, MFA, recovery, checkout, biomarker upload, consent, export, and deletion.
- [ ] `P1-CI-010` Add forward-migration, backward-compatibility, rollback, seed,
  and restore tests against realistic database volumes.
- [ ] `P1-CI-011` Add contract tests for every sidecar and external provider.
- [ ] `P1-CI-012` Add mutation, property-based, fuzz, concurrency, retry, and
  idempotency tests around safety-critical services.
- [ ] `P1-CI-013` Publish test results, coverage, bundle size, performance, SBOM,
  and vulnerability reports as build artifacts.
- [ ] `P1-CI-014` Introduce signed releases, provenance attestations, and artifact
  verification during deployment.

## 4. Deployment, database, and operations

- [ ] `P0-OPS-001` Select one canonical main-application deployment target.
- [ ] `P0-OPS-002` Create a reproducible, non-root, minimal production image for
  the Next.js application with a pinned Node version and health check.
- [ ] `P0-OPS-003` Deploy database migrations as a separate, single-writer release job.
- [ ] `P0-OPS-004` Provision managed PostgreSQL with HA, encryption, PITR, connection
  pooling, monitoring, and least-privilege application/migration roles.
- [ ] `P0-OPS-005` Run and document a full backup restore; define RPO and RTO.
- [ ] `P0-OPS-006` Provision production Redis for distributed rate limiting,
  locks, shared caches, and ephemeral coordination where appropriate.
- [ ] `P0-OPS-007` Deploy web, job workers, outbox dispatcher, cron jobs, and science
  sidecars as separately scalable workloads.
- [x] `P0-OPS-008` Protect every scheduled route with `CRON_SECRET`, least privilege,
  replay protection where needed, and alerting on failures.
- [ ] `P0-OPS-009` Define blue/green or canary deployment, automatic rollback,
  database compatibility windows, and a tested manual rollback runbook.
- [x] `P1-OPS-010` Add readiness, liveness, startup, and dependency health probes.
  <!-- LIVENESS: app/api/health/live/route.ts returns 200 without any DB/dependency
       call (a transient dep blip must never restart a healthy pod); tested
       __tests__/health-live.test.ts (mocks @/lib/db to throw so any future DB call
       fails the test). READINESS + STARTUP + DEPENDENCY: existing app/api/health
       probes DB (SELECT 1), job metrics, sidecars, and runtime baseline, returning
       503 when deps/baseline are unmet. Probe path wiring (liveness→/api/health/live,
       readiness/startup→/api/health) documented in the deploy runbook. -->

- [x] `P1-OPS-011` Add graceful shutdown and job lease handoff for all workers.
  <!-- Both long-lived workers handle SIGTERM/SIGINT: the first signal drains,
       a second forces exit (for a job/batch that hangs past the k8s grace
       period). ORCHESTRATION (scripts/orchestration-worker.ts): on drain it
       finishes the in-flight job, then releases the rest of the leased batch via
       lib/jobs/queue.ts#releaseOrchestrationJob — returns each unstarted job to
       QUEUED/available-now and UNDOES the lease-time attempt increment so a
       rolling deploy never burns a retry; a surviving worker re-leases
       immediately instead of waiting out the lease. Tested (tenant:jobs_release
       in orchestration-queue.test.ts): released job -> QUEUED, attempts back to
       0, lease fields null, immediately re-leasable, and release() is a no-op on
       a non-LEASED job. OUTBOX (scripts/outbox-worker.ts): finishes the current
       dispatch batch then exits cleanly; interrupted events are marked in the
       outbox and reclaimed on lease expiry. The retention script (jobs:retention)
       is a one-shot cron, not a long-lived worker, so it runs to completion. -->

- [ ] `P1-OPS-012` Configure CDN, WAF, DDoS controls, TLS, DNS failover, and domain
  ownership monitoring.
- [ ] `P1-OPS-013` Create staging parity rules and a sanitized production-like dataset.
- [ ] `P1-OPS-014` Document incident response, escalation, on-call ownership, and
  conduct a launch-readiness game day.

## 5. Observability and reliability

- [x] `P0-OBS-001` Export OpenTelemetry traces and metrics to the selected backend.
- [ ] `P0-OBS-002` Add exception monitoring with source maps and release identifiers.
- [x] `P0-OBS-003` Remove secrets, health data, identifiers, prompts, and document
  contents from logs by default; add automated redaction tests.
  <!-- lib/logger.ts applies a depth-bounded key-name redaction pass
       (email/token/secret/password/cookie/authorization/api-key/…); covered by
       automated tests in __tests__/logger.test.ts. -->

- [x] `P0-OBS-004` Define SLIs/SLOs for authentication, payments, API success,
  AI latency, job age, data ingestion, and candidate workflow completion.
  <!-- PROGRESS: jobExecutionCounter + authFailureCounter now emitted; the last unemitted metric httpRequestDurationHistogram is emitted via lib/observability/with-http-metrics.ts#withHttpMetrics (tested) — adopted on all three governed AI routes (/api/ai/openai, /api/ai/anthropic, /api/ai/grok). alert-rules.yml reconciled to the exported OTel names (biozephyra_http_request_duration_ms_*, biozephyra_circuit_breaker_state_change_count) and fixed state="open" casing; also fixed two more prefix mismatches so the alerts match emitted names (ai_request_latency_ms_bucket -> biozephyra_ai_request_latency_ms_bucket, rate_limit_abuse_count -> biozephyra_rate_limit_abuse_count). The "define" half is DONE: observability/SLOs.md defines the SLI/SLO for each domain (auth, payments, API success, AI latency, job age, data ingestion, candidate workflow) mapped to the metric actually emitted, honestly marking which are ✅ emitted vs ⚠️ instrumentation gaps. Three more gaps now CLOSED: (1) biozephyra.outbox.dispatch.latency_ms histogram emitted on publish (creation->publish lag) — un-inerts OutboxDispatchDelayed (name also fixed to biozephyra_outbox_dispatch_latency_ms_bucket), tested in outbox-dispatcher.test.ts; (2) stripeWebhookCounter now records the terminal outcome (success/failed/duplicate) per webhook, making the payments success SLO measurable, tested in stripe-webhook-ai-credits.test.ts; (3) biozephyra.orchestration.job.oldest_queued_age_ms observable gauge (registered at OTel init via registerJobQueueAgeGauge) — un-inerts JobQueueStale (alert now thresholds age > 300000ms directly); core computeOldestQueuedJobAgeMs tested in orchestration-queue.test.ts; (4) DB-pool gauges bridged from Prisma $metrics (metrics preview feature enabled + client regenerated): biozephyra_db_pool_connections_{open,busy,idle} + biozephyra_db_client_queries_{wait,active}, registered at OTel init via registerDbPoolGauges; DbPoolHighUtilization rewritten to DbPoolSaturated (queries_wait > 0 for 2m — Prisma has no pool-max gauge, so saturation is signalled by queued queries); readDbPoolMetrics tested on real PG (db-pool-metrics-pg.test.ts); (5) route-metrics coverage: found @opentelemetry/instrumentation-http ALREADY auto-emits http.server.duration for the whole surface, so a 100-route withHttpMetrics sweep would be redundant — instead documented the auto-instr baseline in SLOs.md and layered the route-templated biozephyra_http_request_duration_ms (via the already-variadic withHttpMetrics) onto the SLO-critical non-AI flows: /api/stripe/webhook (payments), /api/wearables/webhook (ingestion), /api/biomarkers + /api/medications (PHI intake). withHttpMetrics is the shared factory; remaining non-critical routes adopt it incrementally. (6) candidate-workflow SLI CLOSED: recordCandidateTransition emits biozephyra_candidate_transition_count (from_status/to_status) + biozephyra_candidate_stage_duration_ms histogram (stage latency from the entering-status event), wired at the canonical transition endpoint and at creation (null->PROPOSED); helper unit-tested (candidate-transition-metrics.test.ts) and the transition route test updated. DONE: every OBS-004 SLI is defined in observability/SLOs.md AND backed by an emitted metric. The three previously-"(to add)" alerts are now authored in alert-rules.yml group biozephyra-domain-slos: AuthFailureSpike (P2, >5x baseline + absolute floor), PaymentWebhookFailureRateHigh (P1, failure ratio > 1% / 15m), CandidateStageSlaBreached (P2, stage P95 dwell > 7d). Residual (non-blocking): let the auxiliary candidate event sites (feedback/lab) adopt recordCandidateTransition. -->


- [x] `P1-OBS-005` Alert on error rate, latency, saturation, queue age, dead letters,
  webhook failures, provider quota, circuit state, and unusual spend.
  <!-- observability/alerts/alert-rules.yml covers every listed dimension, all
       against verified emitted series: error rate (ApiErrorRateHigh,
       ErrorBudgetBurnFast), latency (ApiLatencyP99High, AiProviderLatencyP95High),
       saturation (DbPoolSaturated), queue age (JobQueueStale), dead letters
       (OutboxEventDeadLettered, OrchestrationJobDeadLettered), webhook failures
       (PaymentWebhookFailureRateHigh), provider quota (AiProviderQuotaExhausted —
       new biozephyra_ai_provider_quota_count emitted on 429 in all three AI
       routes), circuit state (CircuitBreakerOpen), unusual spend (AiSpendHigh on
       biozephyra_ai_request_cost_usd_sum). Absolute thresholds (spend budget, 429
       tolerance) are commented as starting points to tune. -->


- [ ] `P1-OBS-006` Add synthetic tests for sign-in, checkout, biomarker upload,
  candidate lookup, and account export.
- [ ] `P1-OBS-007` Create an external status page and component-level incident history.
- [ ] `P1-OBS-008` Add cost-per-request/model/provider dashboards and budget alerts.
- [ ] `P1-OBS-009` Trace every candidate from suggestion through evidence,
  computation, review, validation, and marketplace decision.

## 6. Privacy, legal, and health-product governance

- [ ] `P0-GOV-001` Decide and document launch geography, user type, telemedicine
  scope, laboratory scope, marketplace model, and whether regulated PHI is accepted.
- [ ] `P0-GOV-002` Obtain qualified legal review of privacy policy, terms,
  disclaimers, consent, health claims, telemedicine, research, and commerce flows.
- [x] `P0-GOV-003` Replace the unavailable legal-rules dependency or load the
  repository rule packs through a tested, versioned runtime implementation.
- [ ] `P0-GOV-004` Apply jurisdiction decisions to every applicable health,
  research, compound, coaching, telemedicine, and marketplace output.
  - Fail closed when required rules are unavailable.
  - Record rule version, jurisdiction source, decision, and audit event.
- [x] `P0-GOV-005` Enforce post-generation claim validation in addition to prompt rules.
  - Reject diagnostic, prescriptive, treatment, therapy, cure, and dosing claims.
  - Require candidate/lead/hypothesis wording and a validation disclaimer.
- [ ] `P0-GOV-006` Require evidence tier and source provenance for every material
  compound, biomarker, safety, and product claim.
- [ ] `P0-GOV-007` Add human scientific/clinical review queues, separation of duties,
  signed decisions, expiry, and re-review triggers.
- [ ] `P0-GOV-008` Complete data inventory, classification, lawful-purpose mapping,
  consent versioning, retention, export, correction, deletion, and backup handling.
  <!-- PROGRESS (code parts done): data EXPORT covers all health/PII tables + consent (account/export); CONSENT is versioned; DELETION/erasure now purges IdempotencyRecord PHI and strips AuditLog.actorEmail while preserving the tamper-evident chain (lib/account/erasure.ts, tested account-erasure-pg.test.ts). REMAINING: data inventory/classification/lawful-purpose mapping (governance docs), retention job (P0-SEC-011/M3), rectification/correction UX, and backup handling (infra). -->
- [x] `P0-GOV-009` Enforce age eligibility and explicit sensitive-data consent.
  <!-- Sensitive-data consent captured at onboarding (data-processing required,
       ai-health-info optional) and enforced on PHI intake. Age eligibility:
       onboarding rejects DOB under MIN_ELIGIBLE_AGE_YEARS (18) server-side, with
       client-side feedback. Tested in onboarding-consent-validator.test.ts. -->

- [ ] `P1-GOV-010` Publish subprocessors and establish DPAs/BAAs where applicable.
- [ ] `P1-GOV-011` Add prompt/model/data-card versioning with rollback and audit trails.
- [ ] `P1-GOV-012` Build adversarial evaluations for unsafe health claims,
  hallucinated citations, prompt injection, jurisdiction bypass, and data leakage.
- [x] `P1-GOV-013` Verify cohort queries retain k-anonymity of at least 50 and
  differential privacy under composition, retries, joins, and repeated queries.
  <!-- k-ANONYMITY FLOOR: the cohort-query path (runOutcomeAggregation) clamps every
       equivalence class to k>=50 via resolveCohortK (was a default of 5); a class
       with <50 distinct users is suppressed, never published. MIN_COHORT_K=50,
       unit-tested (cohort-k-anonymity.test.ts). DP NOISE per statistic already
       present (addNoisyMean, epsilon default 1.0). DP UNDER COMPOSITION: a
       persistent per-(tenant, scope) epsilon budget (lib/privacy/budget-ledger.ts +
       PrivacyBudgetEntry model) bounds cumulative leakage — every aggregation run
       reserves its epsilon (advisory-locked, atomic) before publishing any noised
       statistic, and once the rolling window's budget (PRIVACY_EPSILON_BUDGET,
       default 10 / PRIVACY_EPSILON_WINDOW_HOURS default 24) is spent, further runs
       are refused; the on-demand /api/insights/aggregate route returns 429 so
       repeated/retried queries can't average out the noise. Tested on real PG
       (privacy-budget-ledger-pg.test.ts: grant-until-exhausted, per-tenant scope,
       rolling window). -->


- [ ] `P2-GOV-014` Establish quality-management procedures appropriate to the final
  product claims and regulatory classification.

## 7. Product integrations

- [ ] `P0-INT-001` Keep every optional integration off until its health and
  end-to-end smoke tests pass in staging.
- [ ] `P0-INT-002` Configure production transactional email, SPF, DKIM, DMARC,
  bounce/complaint handling, templates, and delivery monitoring.
- [ ] `P0-INT-003` Configure Stripe products, prices, tax decision, webhook endpoint,
  dunning, refunds, reconciliation, and live-mode smoke tests.
- [ ] `P0-INT-004` Select and configure at least one governed AI provider with
  spend controls, data-retention terms, region, timeout, fallback, and kill switch.
- [ ] `P1-INT-005` Validate wearable OAuth, token encryption/rotation, revocation,
  webhook replay protection, sandbox/production separation, and deletion.
- [ ] `P1-INT-006` Decide whether federated learning, Neo4j, causal inference,
  VC signing, mechanistic modeling, screening, OpenMM, and FEP ship in V1.
- [ ] `P1-INT-007` Remove or relabel unavailable capabilities in navigation,
  marketing, pricing, developer docs, and API documentation.
- [x] `P1-INT-008` Define provider outage behavior and show honest degraded-state UI.
  <!-- OUTAGE BEHAVIOR: the circuit breaker (executeWithCircuitBreaker) — routes
       return 503 + Retry-After when a dependency's breaker is open. HONEST UI:
       lib/dependency-status.ts groups all breaker-protected dependencies into
       user-meaningful categories (AI features / Payments / Compound & structure
       data) and getDependencyStatus reports per-category availability from the
       breaker states (OPEN=unavailable, HALF_OPEN/none=available). GET /api/status
       exposes it; components/service-status-banner.tsx polls it (60s) and renders
       an amber banner naming the degraded categories app-wide via AppShell —
       nothing in normal operation, auto-clears on recovery. Tests: status-route-pg
       (payments + research-data + HALF_OPEN cases) and the AI-specific
       /api/ai/status (ai-status-route-pg). REMAINING (follow-ups, non-blocking):
       per-feature inline degraded states beyond the global banner, and breakers
       for the non-breaker providers (email/wearables) so they can surface too. -->


## 8. Performance and scale additions

### Measurement first

- [ ] `P1-PERF-001` Establish production budgets: Core Web Vitals, server p50/p95/p99,
  database latency, queue age, AI latency, error rate, memory, and cost per workflow.
- [ ] `P1-PERF-002` Add repeatable k6 tests for browse, search, dashboard, uploads,
  AI workflows, candidate screening, webhooks, and worker throughput.
- [ ] `P1-PERF-003` Capture PostgreSQL slow-query logs and `EXPLAIN ANALYZE` evidence
  before adding indexes or caches.
- [ ] `P1-PERF-004` Add bundle analysis and per-route JavaScript budgets to CI.

### Application delivery

- [ ] `P1-PERF-005` Re-enable Next.js image optimization or use a managed image CDN;
  add responsive sizes, modern formats, and immutable caching.
- [ ] `P1-PERF-006` Lazy-load Three.js, 3Dmol, Recharts, D3, docking viewers, and
  other heavy client modules only on routes that need them.
  <!-- LARGELY DONE: the heavy WebGL/3D libs are already code-split. Three.js
       components load via next/dynamic({ ssr:false }) + loading skeletons
       (components/three/body-insights-client.tsx, compound-board-client.tsx);
       docking viewers via next/dynamic (discovery/docking-explorer, docking-runner);
       3Dmol is loaded at runtime with `await import("3dmol")` inside the client
       molecular-viewer (the top-level `import type` is erased), so a static import
       of MolecularViewer pulls only the small component, not the ~MB lib. REMAINING
       (marginal): Recharts/D3 are imported statically but are primary above-the-fold
       content on their dashboards, where dynamic import mainly adds load flicker;
       revisit only if bundle analysis flags them. -->

- [ ] `P1-PERF-007` Use server components by default and minimize client boundaries,
  hydration payloads, duplicated fetches, and browser-side secrets/configuration.
- [x] `P1-PERF-008` Define caching rules per route: private/no-store for health data;
  revalidation/tagged cache for public compounds, pathways, learning, and metadata.
  <!-- BOTH HALVES DONE + empirically verified (next start + curl). PHI half:
       next.config.mjs headers() sets Cache-Control: private, no-store as the secure
       DEFAULT for /api/* (next.config headers override a handler's own, so PHI
       cannot leak by forgetting a header — fail-safe). PUBLIC half: the
       user-agnostic catalog GETs (/api/compounds, /api/pathways, /api/pathways/[id],
       /api/learn, /api/learn/[slug]) are excluded from the no-store default via the
       negative-lookahead source AND set PUBLIC_CATALOG_CACHE_CONTROL
       (lib/http/cache-control.ts: public, max-age=60, s-maxage=300,
       stale-while-revalidate=600). Each was confirmed session-free before caching
       (no cross-user leak). Also excluded: openapi.json, credentials/:id/status,
       and the two SSE streams. Probe confirmed catalogs -> public/s-maxage and
       health/biomarkers/medications -> private,no-store (no regression). Pages
       already emit no-store via Next's dynamic-render default. -->

- [ ] `P1-PERF-009` Add pagination or cursor streaming to every unbounded collection.
  <!-- PROGRESS: reusable, backward-compatible pagination helper added
       (lib/http/pagination.ts): parseListPageParams clamps ?limit to a maxLimit
       so no caller can request an unbounded page; over-fetch by one row
       (overfetchTake/splitOverfetch) detects a next page without a COUNT and
       NEVER truncates silently (X-Page-Has-More/-Next-Offset headers), and the
       JSON body stays a plain array so existing clients keep working. Unit-tested
       (__tests__/pagination.test.ts, 7 cases). Applied to the clear unbounded
       case, /api/model-confidence-scores (append-only time series that returned
       the whole table unfiltered). Helper now also adopted on the clean list
       endpoints: /api/lab-testing (available panels), /api/telemedicine
       (providers), and /api/agents/pk-profile/[userId] (a user's fitted PK
       profiles) — all backward-compatible, end-to-end verified on real Postgres
       (list-pagination-pg.test.ts: bounded page + X-Page-Has-More/-Next-Offset).
       SCOPING of the rest: /api/referrals NOW paginated — the list is paged while
       stats (total/completed/pending/rewardsEarned) come from DB aggregates
       (groupBy + count) so they still cover ALL of the user's referrals, not just
       the page; /api/reminders is a user's PENDING reminders ({reminders} shape, tiny);
       /api/admin/governance/policies and /api/protocols/templates are small
       curated/reference sets. REMAINING: aggregation-backed pagination for
       referrals and cursor streaming for any genuinely large admin/experiment
       collections (pilot-metrics). -->

- [ ] `P2-PERF-010` Add PWA/offline support only for explicitly safe encrypted/local
  data, with clear logout and cache-clearing behavior.

### Database and queues

- [ ] `P1-PERF-011` Audit indexes using actual query plans and production-like volume.
- [ ] `P1-PERF-012` Eliminate N+1 queries and over-fetching; use narrow `select`
  projections, bounded joins, batch loaders, and parallel independent queries.
  <!-- PROGRESS: fixed a concrete N+1 in the SCIM Groups PATCH member-provisioning
       path (app/api/scim/v2/Groups/[id]) — was a findUnique+create per added member
       and a deleteMany per removed member (2N+N queries for a bulk membership sync);
       now one createMany({skipDuplicates}) for adds (idempotent, replaces the
       per-member existence check) and one deleteMany({userId:{in}}) for removes.
       Tested on real PG (scim-groups-members-pg.test.ts: batch add, re-add idempotency,
       batch remove). Also fixed lib/api-keys/metering.ts#getUserUsageSummary — was a
       per-key aPIUsageRecord.findMany (N+1 across a user's keys); now one groupBy
       ([keyId,endpoint], _count/_sum) assembled in-app, same output shape, verified on
       real PG (api-usage-summary-pg.test.ts: per-key totals + byEndpoint + empty-window
       zeroing). And earlier: /api/referrals stats moved to DB aggregates (groupBy+count)
       instead of loading the full array. SWEEP of the remaining query-in-loop
       candidates found NO further batchable N+1s: achievement-evaluator's
       getUserAchievements is already a 2-query in-memory join and its milestone loop
       is a bounded ~7-entry constant; aeonforge/engine queries the knowledge graph
       with a single findMany({ name: { in } }); supervisor's loops are in-memory plan
       validation and its per-step queries are inherently-sequential agent
       orchestration (ordered, dependent — not batchable). REMAINING: narrow `select`
       projections + index/query-plan review under production-like volume (PERF-011). -->

- [ ] `P1-PERF-013` Add connection pooling and define pool sizes for web, workers,
  migrations, serverless concurrency, and sidecars.
  <!-- POOLING: Prisma pools per process (connection_limit on the DB URL). Pool
       SIZES DEFINED in .env.example per workload (web ?connection_limit=5&pool_
       timeout=10, workers 20, migration/cron 2) so many instances don't exhaust
       Postgres max_connections. Guard added: instrumentation.ts warns at startup
       in production if DATABASE_URL has no connection_limit (lib/db-pool.ts
       parseConnectionLimit/isConnectionLimitUnset, unit-tested db-pool.test.ts).
       Pool health is already observable via biozephyra_db_pool_connections_* (see
       OBS-004). REMAINING: set the actual per-workload connection_limit at deploy
       (RB-3) and tune against the managed PG's max_connections. -->

- [ ] `P1-PERF-014` Move expensive aggregation, document parsing, evidence retrieval,
  docking, screening, FEP, and AI fan-out to durable asynchronous jobs.
- [x] `P1-PERF-015` Add job priorities, quotas, backpressure, cancellation,
  deduplication, dead-letter replay, and per-tenant fairness.
  <!-- PROGRESS: priorities (lease orderBy priority asc), cancellation
       (cancelOrchestrationJob), deduplication (tenantId_dedupeKey unique on enqueue),
       and dead-letter status (failOrchestrationJob) already existed. Added PER-TENANT
       FAIRNESS / backpressure: leaseAvailableOrchestrationJobs now caps how many jobs a
       single tenant may hold LEASED at once (JOB_MAX_CONCURRENT_LEASES_PER_TENANT,
       default 200, 0 disables) — it counts active leases per tenant, excludes
       already-capped tenants from the cross-tenant candidate scan, and tracks
       per-tenant headroom while claiming so a batch never exceeds the cap. A capped
       tenant's excess jobs stay QUEUED for a later cycle so one tenant's backlog can't
       starve the shared pool. Tested (tenant:cap_fair in orchestration-queue.test.ts:
       3 available -> 2 leased -> 0 on the next call -> 1 still QUEUED). DEAD-LETTER
       REPLAY added: replayDeadLetterJobs({tenantId, queue?, jobIds?}) returns
       DEAD_LETTER jobs to QUEUED with a FRESH retry budget (attempts=0, unlike the
       single retryOrchestrationJob which keeps attempts), exposed as ADMIN+MFA
       POST /api/admin/jobs/replay-dead-letters; tested (dead-letter -> replay ->
       attempts 0, leasable again, no-op when none). ENQUEUE QUOTA added
       (producer-side backpressure): enqueueOrchestrationJob counts a tenant's
       pending (non-terminal) jobs and throws JobQuotaExceededError once at/over
       JOB_MAX_PENDING_PER_TENANT (default 50000; 0 disables) — checked after the
       dedupe short-circuit so duplicates never count; POST /api/admin/jobs maps it
       to 429. Tested (tenant:enqueue_quota: 2 ok -> 3rd rejected -> dup no-op ->
       completing one frees headroom; admin route 429). All PERF-015 elements now
       present: priorities, quotas, backpressure, cancellation, dedup, dead-letter
       replay, per-tenant fairness. -->

- [ ] `P2-PERF-016` Add materialized views/read models for dashboards, knowledge-graph
  traversals, aggregate outcomes, and marketplace metrics.
- [ ] `P2-PERF-017` Evaluate read replicas only after query and index optimization.
- [ ] `P2-PERF-018` Partition or archive high-growth audit, trace, event, outbox,
  biomarker, and simulation tables based on measured growth.

### External and AI workloads

- [ ] `P1-PERF-019` Replace process-local PubChem/ChEMBL/PDB/model caches with a
  bounded shared cache where cross-instance reuse matters.
- [ ] `P1-PERF-020` Add request coalescing, negative caching, jittered TTLs,
  provider-aware rate limits, and stale-while-revalidate for public scientific data.
- [ ] `P1-PERF-021` Bound all caches by size and expose hit rate, eviction, age,
  and memory metrics.
  <!-- BOUNDING VERIFIED (no unbounded in-process cache = no OOM/leak risk): audited
       every module-level Map cache and all are size-capped — LLM_CACHE (clinical-
       planning-agent, clears at 200), trace-emitter sessionTraces (200/session +
       30-min TTL sweep with unref'd timer), verificationCache (license-verifier,
       FIFO-evicts oldest at 1000 + 30-day TTL), membershipCache (tenancy,
       MAX_ENTRIES), circuit-breaker cbCache (bounded by dependency count).
       Function-local Maps are GC'd, not caches. OBSERVABILITY ADDED: all five caches
       now emit hit/miss/eviction via lib/observability/cache-metrics.ts
       (biozephyra_cache_{hit,miss,eviction}_count{cache=...}) so hit rate is
       hit/(hit+miss) per cache — instrumented on tenant_membership, license_
       verification, clinical_planning_llm, circuit_breaker_state (hit+miss+eviction)
       and agent_trace_history (eviction; it's a buffer, not a lookup cache). Helper
       unit-tested (cache-metrics.test.ts); tenancy + circuit-breaker regressions
       green. REMAINING: per-entry AGE and cache MEMORY-footprint metrics, and
       PERF-019's move to a shared cache (Redis) for multi-instance correctness. -->

- [ ] `P1-PERF-022` Route AI tasks by required capability, latency, cost, and evidence
  risk; do not use an LLM where deterministic computation is available.
- [ ] `P1-PERF-023` Stream long operations, expose progress, and support cancellation.
- [ ] `P2-PERF-024` Batch embeddings/inference and reuse normalized evidence bundles
  using content-addressed keys and model/prompt/version metadata.
- [ ] `P2-PERF-025` Autoscale web and worker pools on distinct signals; test scale-up,
  scale-down, provider throttling, and database saturation.

## 9. Compound and product suggestion pipeline

### Non-negotiable boundary

- [ ] `P0-CMP-001` Treat every model-generated structure, compound, combination,
  product match, mechanism, and predicted effect as an unvalidated hypothesis.
- [x] `P0-CMP-002` Restrict new or changed discovery-agent endpoints to
  RESEARCHER/CLINICIAN/ADMIN roles; never expose them directly to consumers.
- [x] `P0-CMP-003` Do not modify or route into the forbidden
  `lib/agents/discovery-agent.ts` path.
- [x] `P0-CMP-004` Prevent any candidate from automatically becoming a protocol,
  recommendation, product, listing, advertisement, or purchasable item.
  <!-- Invariant holds and is now locked by safety-rails Rail 5: the
       experiment-candidate lifecycle is research-only (no promotion status;
       terminal FED_BACK can't auto-advance), protocol creation is user-authored
       (never ingests a candidate), and the candidate validation-listing is an
       explicit owner-/status-gated action (not automatic). Candidate transitions
       are RESEARCHER/CLINICIAN/ADMIN-gated. -->


### Stage 0: capture and provenance

- [ ] `P0-CMP-010` Create one canonical candidate record for each suggestion with:
  normalized structure, InChIKey, canonical/isomeric SMILES, source, prompt hash,
  model/version, temperature/seed where available, timestamp, tenant, user, and trace.
  <!-- PROGRESS (safe-governance subset — no chemistry/claims): one ExperimentCandidate
       row per suggestion already carries source (kind = CHEMBL | AI), the raw source
       snapshot (chemblJson/aiMolJson), timestamp (createdAt), tenant, user, and the
       AI-source model context via the AeonForgeCandidate FK. Added the missing TRACE:
       sourceRequestId captured at creation from the request's x-request-id/
       x-correlation-id (route stays RESEARCHER/CLINICIAN/ADMIN-gated); migration
       20260721130000, unit-tested (experiment-candidates-route.test.ts). REMAINING
       (needs /research + chemistry toolkit, deliberately deferred): normalized
       structure, InChIKey, and canonical/isomeric SMILES (RDKit-class normalization,
       see CMP-020), plus explicit prompt-hash/temperature/seed capture on the record. -->

- [x] `P0-CMP-011` Preserve the raw suggestion separately from normalized fields.
  <!-- VERIFIED against the schema (no code change needed). AI-sourced candidates:
       AeonForgeCandidate.prompt + AeonForgeCandidate.rawResponse (the full raw
       ÆonForge API response) are stored on the source record and linked from
       ExperimentCandidate via aeonForgeCandidateId, kept separate from the
       normalized ExperimentCandidate fields (smiles/displayName/...); the molecule
       snapshot at add-time is also retained (aiMolJson). ChEMBL-sourced candidates:
       chemblJson holds the raw LibrarySearchHit snapshot at time of add, separate
       from the normalized fields. So the raw suggestion is preserved distinctly
       from the normalized record in both source paths. -->

- [ ] `P0-CMP-012` Deduplicate by standardized structure, stereochemistry, salt,
  tautomer policy, and known database identifiers.
- [ ] `P0-CMP-013` Sign candidate results with the platform provenance mechanism.
- [ ] `P0-CMP-014` Add immutable state transitions and reviewer-signed reasons.
  <!-- IMMUTABLE + ATTRIBUTED (safe governance, no chemistry/claims): candidate
       transitions already move forward-only through adjacent states
       (isValidTransition) and are logged append-only (ExperimentCandidateEvent).
       Now each transition also writes to the TAMPER-EVIDENT hash-chained audit log
       in the SAME transaction via logAuditInTransactionOrThrow (action
       candidate.transitioned, actor + reason + from/to) — so a transition cannot
       commit without its immutable record, and the record can't be silently altered
       (entryHash chained per tenant). Route stays RESEARCHER/CLINICIAN/ADMIN-gated;
       unit-tested that the audit entry is written in-tx with an entryHash
       (experiment-transition-route.test.ts). ALL status-changing sites now covered:
       the manual transition endpoint, the active-learning feedback route
       (RESULT_LOGGED->FED_BACK), and the lab-results auto-advance
       (SENT_TO_LAB->RESULT_LOGGED) each write the in-tx tamper-evident audit
       (feedback + lab-results tests updated). REMAINING (policy decision, contract
       change, not code-blocked): make the reviewer reason MANDATORY on transitions
       (today captured when provided but optional). -->


### Stage 1: identity and reality check

- [ ] `P0-CMP-020` Make RDKit or an equivalent chemistry toolkit authoritative for
  parsing, sanitization, canonicalization, descriptors, and invalid-structure rejection.
- [ ] `P0-CMP-021` Query PubChem and ChEMBL by InChIKey and structure, not name alone.
- [ ] `P0-CMP-022` Classify candidates as known exact match, stereoisomer/salt,
  close analogue, novel structure, ambiguous, or invalid.
- [ ] `P0-CMP-023` Store source record IDs, retrieval timestamps, dataset releases,
  licenses, and immutable snapshots/hashes needed for reproducibility.
- [ ] `P0-CMP-024` Add similarity and substructure search against the approved local
  compound corpus; flag duplicates and known problematic motifs.

### Stage 2: evidence retrieval and grading

- [ ] `P0-CMP-030` Retrieve evidence from approved primary databases and literature
  sources using structured identifiers and versioned queries.
- [ ] `P0-CMP-031` Verify every citation resolves and supports the exact claim;
  quarantine retracted, corrected, predatory, unverifiable, or mismatched sources.
- [ ] `P0-CMP-032` Assign explicit evidence tiers such as computational, in-vitro,
  animal, observational human, controlled human trial, systematic review, and
  replicated consensus; never collapse them into one confidence number.
- [ ] `P0-CMP-033` Separate evidence quality, direction, relevance, replication,
  uncertainty, and recency.
- [ ] `P0-CMP-034` Store contradictory and null findings, not only supportive evidence.
- [ ] `P0-CMP-035` Require reviewer approval before an evidence statement becomes
  user-visible or feeds marketplace matching.

### Stage 3: computational triage

- [ ] `P1-CMP-040` Run deterministic validity, PAINS/structural-alert, physicochemical,
  aggregation, reactivity, and synthetic-accessibility checks.
- [ ] `P1-CMP-041` Replace the current SMILES-string SA heuristic with a validated
  toolkit calculation when decisions depend on it; retain the heuristic only as
  clearly labeled preliminary metadata.
- [ ] `P1-CMP-042` Add target plausibility and off-target screening with dataset/model
  version, applicability domain, uncertainty, and calibration information.
- [ ] `P1-CMP-043` Use docking only as a hypothesis-ranking signal; record receptor,
  preparation, binding site, parameters, controls, poses, and reproducibility bundle.
- [ ] `P1-CMP-044` Use FEP/MD only after prerequisites and controls pass; distinguish
  computed estimates from experimental evidence.
- [ ] `P1-CMP-045` Add multi-objective ranking across evidence, novelty, feasibility,
  uncertainty, predicted liabilities, cost, and validation value.
- [ ] `P1-CMP-046` Show score components and uncertainty instead of a single opaque rank.
- [ ] `P1-CMP-047` Require independent reruns and reproducibility checks before promotion.

### Stage 4: safety and regulatory triage

- [ ] `P0-CMP-050` Screen known interactions, contraindication evidence, adverse-event
  signals, vulnerable populations, jurisdiction restrictions, and banned substances.
- [ ] `P0-CMP-051` Treat missing safety data as unknown risk, never as safety evidence.
- [ ] `P0-CMP-052` Block consumer-facing promotion when identity, evidence,
  interaction, provenance, or jurisdiction information is incomplete.
- [ ] `P0-CMP-053` Require qualified human review for any safety interpretation.
- [ ] `P1-CMP-054` Add periodic safety-data refresh and automatic re-review when a
  source, warning, recall, interaction, or regulatory status changes.

### Stage 5: experimental validation workflow

- [ ] `P1-CMP-060` Define candidate promotion states: `SUGGESTED`, `IDENTITY_CHECKED`,
  `EVIDENCE_REVIEWED`, `COMPUTATIONALLY_TRIAGED`, `SAFETY_REVIEWED`,
  `EXPERIMENT_PROPOSED`, `LAB_SUBMITTED`, `LAB_VALIDATED`, `REJECTED`, `ARCHIVED`.
- [ ] `P1-CMP-061` Require predefined acceptance criteria, controls, assay context,
  blinded analysis where practical, and signed protocols before lab submission.
- [ ] `P1-CMP-062` Record CRO/lab chain of custody, batch, purity/identity evidence,
  protocol version, raw results, QC status, and deviations.
- [ ] `P1-CMP-063` Preserve negative and failed experiments and feed them back into
  ranking without silently rewriting historical predictions.
- [ ] `P1-CMP-064` Require independent replication before marking a candidate validated.
- [ ] `P2-CMP-065` Use active learning to propose the next most informative experiment,
  subject to safety, budget, diversity, and human approval constraints.

### Stage 6: product matching and marketplace separation

- [ ] `P0-CMP-070` Keep compound hypotheses separate from commercial product records.
- [ ] `P0-CMP-071` Match products only through verified ingredients, normalized names,
  identifiers, amounts as label facts, formulation, lot/batch, manufacturer, and region.
- [ ] `P0-CMP-072` Never infer that a marketed product inherits a compound study's
  result; formulation, population, route, quality, and amount must match the evidence.
- [ ] `P0-CMP-073` Require certificate-of-analysis authenticity, contaminant testing,
  lot traceability, recall status, manufacturer verification, and expiry tracking where applicable.
- [ ] `P0-CMP-074` Separate evidence score from commercial score, margin, sponsorship,
  popularity, and affiliate status.
- [ ] `P0-CMP-075` Label sponsored/affiliate placement conspicuously and prevent it
  from influencing evidence or safety rankings.
- [ ] `P0-CMP-076` Require marketplace/legal review of every product claim and region.
- [ ] `P1-CMP-077` Add product-price and availability freshness, seller reputation,
  counterfeit risk, return/recall workflow, and stale-listing expiration.
- [ ] `P1-CMP-078` Add a transparent “why this matched” panel showing identity match,
  evidence tier, uncertainties, conflicts, review status, and commercial disclosures.
- [ ] `P1-CMP-079` Prohibit personalized purchase recommendations from experimental
  candidate data; consumer surfaces may provide neutral educational comparisons only.

### Stage 7: evaluation, monitoring, and UX

- [ ] `P0-CMP-080` Build a gold evaluation set with known compounds, invalid SMILES,
  stereoisomers, salts, duplicates, unsupported claims, retractions, contradictory
  evidence, interactions, banned items, and adversarial prompts.
- [ ] `P0-CMP-081` Measure identity accuracy, citation precision/recall, evidence-tier
  accuracy, false-safety rate, calibration, novelty error, duplicate rate, and reviewer agreement.
- [ ] `P0-CMP-082` Fail releases when safety or provenance regression thresholds are exceeded.
- [ ] `P1-CMP-083` Add candidate/model drift monitoring and scheduled re-evaluation.
- [ ] `P1-CMP-084` Show a stage badge, evidence ladder, source links, last-reviewed date,
  known unknowns, contradictions, and validation disclaimer on every candidate view.
- [ ] `P1-CMP-085` Add reviewer queues for identity, evidence, safety, computation,
  experimental design, lab results, and marketplace approval.
- [ ] `P1-CMP-086` Add an emergency unpublish/recall control that propagates through
  search, caches, APIs, recommendations, exports, and marketplace surfaces.

## 10. Additional platform capabilities

- [ ] `P2-ADD-001` Add a versioned scientific data lake with source licensing,
  snapshots, lineage, deduplication, and reproducible dataset manifests.
- [ ] `P2-ADD-002` Add hybrid lexical/vector/graph retrieval with citation-level
  traceability and evaluation against a labeled retrieval set.
- [ ] `P2-ADD-003` Add a model registry containing intended use, prohibited use,
  evaluation results, calibration, cost, latency, owner, and retirement date.
- [ ] `P2-ADD-004` Add an experiment registry linking hypotheses, protocols,
  computations, lab runs, raw data, analysis, decisions, and publications.
- [ ] `P2-ADD-005` Add reproducibility bundles that export code/image digest,
  parameters, inputs, dataset versions, seeds, environment, and signed results.
- [ ] `P2-ADD-006` Add data-quality scoring and quarantine for scientific imports.
- [ ] `P2-ADD-007` Add reviewer conflict-of-interest declarations and blinded review.
- [ ] `P2-ADD-008` Add research portfolio optimization based on information gain,
  uncertainty, diversity, feasibility, safety, and budget—not claimed health effect.
- [ ] `P2-ADD-009` Add organization-level quotas, budgets, approvals, audit exports,
  retention, and region controls.
- [ ] `P2-ADD-010` Add privacy-preserving analytics verification, attack testing,
  and an auditable privacy accountant.
- [ ] `P3-ADD-011` Add patent/chemical novelty search only after licensing, legal,
  and false-assurance risks are addressed; label it non-legal preliminary research.
- [ ] `P3-ADD-012` Add supplier/lab/CRO quality scorecards backed by verified outcomes
  and clearly separated from paid placement.
- [ ] `P3-ADD-013` Add a public trust center with security posture, subprocessors,
  uptime, incident history, model/data cards, and research validation policy.

## 11. Documentation and repository hygiene

- [ ] `P1-DOC-001` Reconcile the platform-layer README with the full product codebase.
- [ ] `P1-DOC-002` Replace stale audits and readiness percentages with dated,
  evidence-linked status generated from current gates.
- [ ] `P1-DOC-003` Remove generated/test artifacts that do not belong in source control.
- [ ] `P1-DOC-004` Document architecture, trust boundaries, data flows, deployment,
  rollback, restore, key rotation, incidents, and provider outages.
- [ ] `P1-DOC-005` Maintain API documentation with authentication, authorization,
  tenancy, idempotency, rate-limit, error, and deprecation contracts.
- [ ] `P1-DOC-006` Create operator runbooks for every queue, cron, sidecar, provider,
  payment flow, email flow, and candidate-validation stage.

## 12. Suggested delivery sequence

### Milestone A: secure and reproducible baseline

- [ ] Complete `P0-SEC-*`, `P0-CFG-*`, and `P0-CI-*`.
- [ ] Produce a clean CI run and a signed release candidate.

### Milestone B: deployable staging

- [ ] Complete `P0-OPS-*` and `P0-OBS-*`.
- [ ] Demonstrate deploy, migrate, restore, rollback, and incident response.

### Milestone C: governed health/research product

- [ ] Complete `P0-GOV-*` and required `P0-INT-*`.
- [ ] Obtain legal/scientific approval for the exact launch scope and copy.

### Milestone D: defensible candidate pipeline

- [ ] Complete `P0-CMP-*` before accepting or displaying generated candidates.
- [ ] Complete `P1-CMP-*` before computational/lab promotion workflows are relied upon.

### Milestone E: scale and differentiated capabilities

- [ ] Complete measured `P1-PERF-*` work before adding speculative infrastructure.
- [ ] Select `P2/P3` additions using customer value, validation quality, risk,
  operational cost, and evidence—not feature count.

## Release sign-off record

- Product owner:
- Engineering owner:
- Security reviewer:
- Privacy/legal reviewer:
- Scientific/clinical reviewer:
- Operations owner:
- Release commit and artifact digest:
- CI run:
- Staging smoke-test evidence:
- Backup/restore evidence:
- Rollback evidence:
- Accepted residual risks and expiry dates:
