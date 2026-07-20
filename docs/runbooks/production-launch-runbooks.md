# Production-launch runbooks (infra / vendor / legal)

Execution guides for the `PRODUCTION-GRADE-TODO.md` P0 items that require
infrastructure provisioning, a third-party account, a business decision, or a
lawyer — i.e. the ones that cannot be closed by application code alone. Each
runbook lists the exact steps, the env/config the code already expects, an
acceptance check, and the backlog checkbox it closes.

Conventions:
- The app is Next.js 16 + Prisma + **PostgreSQL only**. Enforcement of the
  production baseline is keyed on `APP_ENV=production` **or**
  `RUNTIME_REQUIREMENTS_ENFORCED=true`; a plain `NODE_ENV=production` deploy is
  additionally guarded against the dev NextAuth secret / SQLite fallback
  (`lib/env.ts#assertNoDevFallbacksInProduction`).
- Secrets are 32+ char random. Generate with: `openssl rand -base64 48`.
- "Acceptance" commands assume the target env vars are exported.

---

## RB-1 — Managed PostgreSQL (P0-OPS-004, P0-OPS-003, P0-OPS-005)

**Goal:** HA Postgres with encryption at rest, PITR, connection pooling, and a
migrations-as-a-job deploy step.

1. Provision managed Postgres (Neon / Supabase / AWS RDS / Cloud SQL). Enable:
   encryption at rest, automated backups + **PITR**, and a **pooled** connection
   endpoint (PgBouncer / Neon pooler). Create two roles:
   - `agedefy_app` — CRUD only (used by the web app, pooled URL).
   - `agedefy_migrator` — DDL (used only by the migration job, **direct** URL).
2. Set env (app uses the pooled URL; migrations use the direct URL):
   - `DATABASE_URL` / `POSTGRES_DATABASE_URL` = pooled `agedefy_app` URL.
   - `POSTGRES_SHADOW_DATABASE_URL` = a scratch DB for `prisma migrate diff` (dev only).
   - Migration job env: `DATABASE_URL` = **direct** `agedefy_migrator` URL.
3. Run migrations as a **separate, single-writer release job** (not from the web
   container), before traffic shifts:
   ```
   pnpm db:generate && pnpm db:deploy
   ```
   The Helm path already does this (`helm-release.yml`); on Vercel run it as a
   pre-deploy step / one-off job, never concurrently from N instances.
4. **First-deploy data migrations** (run once, in order, after `db:deploy`):
   ```
   pnpm secrets:migrate:screening-adapters   # encrypt any legacy plaintext adapter secrets
   pnpm consent:backfill                      # grant data-processing consent to already-onboarded users
   ```

**Acceptance (P0-OPS-005 — prove restore):** take a snapshot, restore it into a
scratch instance, point `DATABASE_URL` at it, run `pnpm db:deploy` (no pending
migrations) and `pnpm test:postgres`. Record **RPO** (≤ backup interval) and
**RTO** (measured restore time) in the release tracker. Then check
`P0-OPS-003/004/005`.

---

## RB-2 — Production Redis (P0-OPS-006)

**Goal:** distributed rate-limiting + shared coordination (the code fails closed
without it when the baseline is enforced — `getRuntimeBaseline` raises
`ratelimit.redis_required`).

1. Provision **Upstash Redis** (the client is `@upstash/redis`, REST-based).
2. Set `REDIS_URL` and `REDIS_TOKEN` (Upstash REST URL + token).

**Acceptance:** with `APP_ENV=production` set, boot the app — it must NOT throw
`ratelimit.redis_required`, and `getRateLimitBackend()` returns `"redis"`. Then
check `P0-OPS-006`.

---

## RB-3 — Canonical deploy target + workloads (P0-OPS-001, P0-OPS-002, P0-OPS-007, P0-OPS-009)

**Goal:** one reproducible artifact, workers deployed independently, blue/green +
rollback.

**Option A — Vercel (web) + a worker host:** the web app deploys from Vercel
(`vercel.json` already defines the crons `/api/cron/aggregate` and
`/api/cron/reminders`; both are `CRON_SECRET`-guarded). Run the long-lived
workers on a small container host (Railway / Fly / a VM):
```
pnpm jobs:worker      # orchestration queue worker
pnpm outbox:worker    # canonical-event outbox dispatcher
pnpm jobs:retention   # schedule daily (purges expired jobs + idempotency/verification rows)
```
**Option B — Kubernetes/Helm:** a root multi-stage, non-root `Dockerfile` and
`.dockerignore` already exist; `publish-image.yml` builds+scans the image and
`helm-release.yml` runs `db:deploy` then deploys. Deploy web / `jobs:worker` /
`outbox:worker` / cron as **separate** Deployments/CronJobs.

**Health probes (P1-OPS-010):** point the orchestrator's **liveness** probe at
`GET /api/health/live` — it returns 200 with no DB or dependency call, so a
transient DB/Redis blip never restarts a healthy pod. Point **readiness** and
**startup** probes at `GET /api/health` — it checks DB (`SELECT 1`), job metrics,
sidecars, and the runtime baseline, returning 503 until dependencies are up (give
`startup` a generous `failureThreshold` for first-boot migrations). On Helm these
map to the Deployment `livenessProbe` / `readinessProbe` / `startupProbe`; on
Vercel (serverless, no pod lifecycle) use `/api/health` as the external
uptime-monitor target.

**Blue/green + rollback (P0-OPS-009):** use the platform's immutable deploys
(Vercel promote/rollback, or Helm `helm rollback`). Document a **DB
compatibility window** (only additive migrations between the two live versions)
and a tested manual rollback in the release tracker.

**Acceptance:** deploy the same artifact to staging, shift traffic, then roll
back — capture evidence. Check `P0-OPS-001/002/007/009`.

---

## RB-4 — Deploy-time env assertion (supports every OPS/INT item)

The repo ships a fail-closed env asserter. Run it as the **first** step of every
deploy (before traffic):
```
pnpm deploy:assert-env
```
It refuses to proceed if a required production var is missing/malformed and
asserts `ENABLE_TEST_AUTH_ENDPOINT=false`. Wire it into the deploy pipeline as a
gating step.

---

## RB-5 — Transactional email (P0-INT-002)

**Goal:** deliverable email (password reset, verification) with SPF/DKIM/DMARC.

1. Pick a provider (Resend / Postmark / SES). Set:
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`.
   (The code sends via `lib/services/email-service.ts` using nodemailer 9.)
2. In DNS for the sending domain add **SPF**, **DKIM** (provider keys), and a
   **DMARC** record (`p=quarantine` → `reject` once clean). Configure the
   provider's bounce/complaint webhook.

**Acceptance:** trigger a password reset in staging; confirm delivery and that
`mail-tester.com` scores 10/10 (SPF+DKIM+DMARC pass). Check `P0-INT-002`.

---

## RB-6 — Stripe production config (P0-INT-003)

**Goal:** live products/prices, verified webhook, tax, dunning, reconciliation.
Code is ready: the webhook verifies the signature and is idempotent
(claim→complete) with fail-open retry on error.

1. In the Stripe Dashboard (live mode): create the Products/Prices, set the tax
   behavior, and register the webhook endpoint `POST /api/stripe/webhook`
   (subscribe to `checkout.session.completed`,
   `customer.subscription.{created,updated,deleted}`, `invoice.payment_failed`).
2. Set env: `STRIPE_SECRET_KEY` (live `sk_live_…`), `STRIPE_WEBHOOK_SECRET`
   (the endpoint's `whsec_…`), `STRIPE_GRAPH_PRICE_ID`. Enable Smart Retries
   (dunning) in the Dashboard.

**Acceptance:** run a live-mode test purchase; confirm the subscription flips to
ACTIVE and the webhook shows `2xx`. Replay the event from the Dashboard and
confirm it is treated as a duplicate (no double-grant). Check `P0-INT-003`.
Also require Stripe keys in the baseline (add to `lib/env.ts` if you want boot to
fail without them).

---

## RB-7 — Governed AI provider (P0-INT-004)

**Goal:** at least one provider configured with spend controls, region,
data-retention terms, timeout, fallback, and a kill switch.

1. Set the provider key(s): `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GROK_API_KEY`
   and `AI_ALLOWED_MODELS` (allow-list). Governance: `AI_GOVERNANCE_ENFORCED=true`,
   `AI_REQUIRE_AUTH=true`. Kill switch: the `NEXT_PUBLIC_ENABLE_*` flags.
2. In the provider console: set a **monthly spend cap**, choose a **data region**,
   and enable the **no-training / zero-retention** option (see also RB-11 —
   PHI-to-LLM is a compliance gate). The AI routes already have a 30s timeout +
   circuit breaker + credit reservation.

**Acceptance:** with the key set and a spend cap in place, an AI route returns a
governed response; disabling the feature flag returns it to unavailable. Check
`P0-INT-004`.

---

## RB-8 — Envelope-encrypt secrets with KMS (P0-SEC-002)

**Status:** `ExternalScreeningAdapter.secret` is already stored AES-256-GCM
encrypted at the app boundary (`lib/external-secret-crypto.ts`), keyed by
`SCREENING_ADAPTER_ENCRYPTION_KEY`. This runbook upgrades that key to a managed
KMS/HSM.

1. Create a KMS key (AWS KMS / GCP KMS / Vault Transit). Store the data-key
   material in the secret manager, injected as `SCREENING_ADAPTER_ENCRYPTION_KEY`
   at runtime (never in git). Keep `SCREENING_ADAPTER_ALLOW_PLAINTEXT` unset in prod.
2. For true envelope encryption (key-version + rotation), extend
   `external-secret-crypto.ts` to wrap the data key with the KMS CMK and store the
   key version alongside the ciphertext, then run
   `pnpm secrets:migrate:screening-adapters` to re-wrap existing rows.

**Acceptance:** rotate the KMS key, run the migration, confirm old + new rows
decrypt and a wrong key throws (fail-closed). Check `P0-SEC-002`.

---

## RB-9 — Least-privilege secret scopes + var docs (P0-CFG-002, P0-CFG-007, P0-CFG-008)

1. **Scopes (CFG-007):** create separate secret stores/identities for dev, CI,
   staging, prod (e.g. GitHub Environments + a cloud secret manager). CI gets
   only test placeholders; prod secrets are readable only by the deploy identity.
2. **Documentation (CFG-002):** `.env.example` already enumerates every variable.
   Add an owner + sensitivity + rotation cadence column per variable in the
   release tracker (or extend `.env.example` comments).
3. **Drift detection (CFG-008):** add a scheduled job that diffs deployed env
   keys against `.env.example` and alerts on missing/extra keys.

**Acceptance:** prod secrets are not readable by the CI identity; a missing prod
var fails `pnpm deploy:assert-env`. Check `P0-CFG-002/007/008`.

---

## RB-10 — Required CI checks + branch protection (P0-CI-006, P0-CI-007)

**Status:** `.github/workflows/quality-gates.yml` already runs install → db:generate
→ db:deploy → typecheck → lint → test:unit → test:postgres → test:integration →
build → `pnpm audit --prod`. `.github/CODEOWNERS` exists.

**Manual (GitHub repo settings — cannot be set from code):**
1. Settings → Branches → add a protection rule for `main`:
   - Require status checks to pass → select the quality-gates jobs (and
     `security.yml` gitleaks/trivy).
   - Require a pull request + **require review from Code Owners**.
   - **Block direct pushes** / require linear history.
2. Requires GitHub Actions to be **billing-enabled** (currently the org is
   billing-locked — resolve in Org → Settings → Billing first, or the checks
   never run).

**Acceptance:** a PR that fails typecheck/lint/tests cannot be merged; a PR
without a code-owner review is blocked. Check `P0-CI-006/007`.

---

## RB-11 — PHI handling for LLMs + jurisdiction (compliance C1, P0-GOV-004/006/007)

These need a **decision + design**, not just a toggle:
1. **PHI → LLM (compliance C1):** either (a) execute a BAA/DPA with each AI
   provider and enable no-training, or (b) de-identify biomarkers/medications
   before prompt construction in `lib/ai/clinical-context.ts`. Do NOT ship
   consumer AI over raw PHI without one of these.
2. **Jurisdiction gate (GOV-004):** the legal rule-packs load at runtime
   (`P0-GOV-003` done) but `gateAndRecord` is not yet called by product routes —
   wire it into the health/coaching/marketplace output paths and record the
   rule version + decision.
3. **Evidence provenance + review queues (GOV-006/007):** require an evidence
   tier + source on material claims and a human review queue with signed
   decisions before any claim is user-visible.

**Acceptance:** legal sign-off on the exact data flows; automated test that a
consumer AI request contains no un-de-identified PHI. Check the relevant GOV items.

---

## RB-12 — External security & assurance (P0-SEC-012, P0-SEC-013, P0-OBS-002)

1. **Sentry / exception monitoring (P0-OBS-002):** add `@sentry/nextjs`, export
   `onRequestError` from `instrumentation.ts`, and forward `app/error.tsx` /
   `app/global-error.tsx` (they already POST to `/api/observability/client-error`;
   point that sink at Sentry too). Add source-map upload + release IDs.
2. **CAPTCHA / bot protection (P0-SEC-012):** add Turnstile/hCaptcha to
   registration, password recovery, and credential verification endpoints.
3. **Penetration test (P0-SEC-013):** engage a third-party pentest against
   staging; remediate all critical/high before launch. External vendor + budget.

**Acceptance:** a thrown server error appears in Sentry; bot-protection blocks a
scripted signup; the pentest report shows no open critical/high. Check the items.

---

## RB-13 — Launch scope + legal review (P0-GOV-001, P0-GOV-002)

The gating **business/legal decisions** (no code):
1. **P0-GOV-001:** decide and document — launch geography, user type (B2C
   wellness vs regulated), telemedicine scope, lab scope, marketplace model, and
   **whether regulated PHI is accepted**. This determines which downstream P0s
   apply (e.g. HIPAA, `MIN_ELIGIBLE_AGE_YEARS`).
2. **P0-GOV-002:** qualified legal review of the privacy policy, terms,
   disclaimers, consent copy, health-claim language, telemedicine, and commerce
   flows. Code presence (`app/privacy`, `app/terms`, `app/disclaimer`) is a
   starting point, not a review.

**Acceptance:** signed launch-scope doc + written legal approval in the release
sign-off record. Check `P0-GOV-001/002`.

---

## First-production-deploy sequence (quick reference)

```
# 0. Provision infra (RB-1 managed PG, RB-2 Redis) and set all prod env vars.
pnpm deploy:assert-env                    # RB-4 — fail closed if anything is missing
pnpm db:generate && pnpm db:deploy        # RB-1 — migrations as a single-writer job
pnpm secrets:migrate:screening-adapters   # one-time: encrypt legacy adapter secrets
pnpm consent:backfill                     # one-time: grandfather already-onboarded users
# then deploy web + workers (RB-3), verify RB-5/6/7 integrations, and complete
# RB-10 branch protection, RB-11 compliance, RB-12 assurance, RB-13 legal sign-off.
```
