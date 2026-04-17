# Biozephyra Level 4 — Remaining Gaps Implementation Guide

> Generated: April 9, 2026  
> Platform status: **69 test files / 490 tests passing, 0 type errors**  
> All locally-implementable items are complete. Every item below requires external infrastructure, vendor accounts, or production environment access.

---

## Priority Legend

| Tag | Meaning |
|-----|---------|
| **P0** | Blocks all production paths — do these first |
| **P1** | Required before launch — no production traffic without these |
| **P2** | Required within 30 days of launch |
| **P3** | Can follow post-launch |

---

## P0 — Infrastructure Foundation

These items block every other external dependency.

### P0-1: Provision Managed PostgreSQL

**What exists:** SQLite for dev/test, a real PostgreSQL migration baseline at `prisma/migrations-postgres/`, Postgres CI smoke job, runtime detection in Prisma config.

**What to do:**

1. Create a managed PostgreSQL 16 instance (Supabase, Neon, AWS RDS, or equivalent).
2. Set `DATABASE_URL` and `POSTGRES_DATABASE_URL` in your deployment environment.
3. Run the migration:
   ```bash
   pnpm db:generate:postgres:runtime
   pnpm db:deploy:postgres
   ```
4. Verify with the CI postgres-smoke job — it already tests this path.

**Verify:** `pnpm smoke:platform` passes against the real Postgres URL.

**Effort:** Small (1–2 hours).

---

### P0-2: Provision Redis

**What exists:** Upstash Redis client in `lib/rate-limit.ts`, auto-fallback to in-memory for dev.

**What to do:**

1. Create an Upstash Redis instance (or any Redis-compatible endpoint).
2. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in your environment.
3. Rate limiting, session governance, and circuit breakers will pick it up automatically.

**Verify:** Hit any rate-limited API route 11+ times in 60 seconds — you should get 429.

**Effort:** Trivial (15 minutes).

---

### P0-3: Provision OTLP Endpoint

**What exists:** OpenTelemetry SDK in `lib/observability/otel.ts` with `OTLPTraceExporter` + `OTLPMetricExporter`. 9 custom metrics (AI cost, latency, Stripe webhooks, jobs, etc). Not console-only.

**What to do:**

1. Sign up for Grafana Cloud (free tier is sufficient for staging) or deploy SigNoz/Jaeger.
2. Set `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g., `https://otlp-gateway-prod-us-east-0.grafana.net/otlp`).
3. Set `OTEL_EXPORTER_OTLP_HEADERS` with your auth token.
4. Restart the app. Traces and metrics should appear within 60 seconds.

**Verify:** Make an API call, check for traces in your backend's UI.

**Effort:** Trivial (30 minutes).

---

### P0-4: Configure AI Provider API Keys

**What exists:** Real `fetch` calls to OpenAI, Anthropic, and Grok APIs. Full governance (model allowlist, cost tracking, audit trail). Circuit breakers. AeonForge has a local engine fallback.

**What to do:**

1. Get API keys from at least one provider:
   - OpenAI: `OPENAI_API_KEY`
   - Anthropic: `ANTHROPIC_API_KEY`
   - xAI (Grok): `XAI_API_KEY`
2. Set `AI_ALLOWED_MODELS` to the models you want to permit (e.g., `gpt-4-turbo,claude-3-sonnet`).
3. Set `AI_GOVERNANCE_ENFORCED=true` and `AI_REQUIRE_AUTH=true`.

**Verify:** Make a POST to `/api/ai/openai` with a valid session — you should get a real AI response.

**Effort:** Trivial (env vars only, ~$0.01 per test query).

---

### P0-5: First Staging Deployment

**What exists:** `Dockerfile`, Helm charts at `charts/`, Kustomize overlays at `k8s/`, staging validation workflow at `.github/workflows/staging-platform-validation.yml`, publish-image workflow for GHCR.

**What to do:**

1. Provision a Kubernetes cluster (EKS/GKE/AKS or a lightweight option like Fly.io / Railway for the app, k8s for workers).
   - *Alternative:* Deploy the Next.js app to Vercel and the background workers (outbox, jobs) to k8s or a cron runner.
2. Push the Docker image:
   ```bash
   docker build -t ghcr.io/kryst-investments-llc/biozephyra-ai:staging .
   docker push ghcr.io/kryst-investments-llc/biozephyra-ai:staging
   ```
3. Set all required secrets in GitHub Actions environment `staging`:
   - `DATABASE_URL`, `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - AI provider keys, Redis, OTLP endpoint
   - `KUBE_CONFIG_DATA` for helm-release workflow
4. Run `tools/set-staging-validation-secrets.ps1` to populate remaining vars.
5. Trigger the staging-platform-validation workflow.

**Verify:** Health check at `GET /api/health` returns 200 with all checks green.

**Effort:** Medium (4–8 hours depending on cluster provisioning).

---

## P1 — Launch Prerequisites

### P1-1: Stripe Product & Webhook Setup

**What exists:** Full webhook handler at `app/api/stripe/webhook/route.ts` (checkout, subscription, invoice events). Signature verification. Marketplace escrow flow.

**What to do:**

1. In Stripe Dashboard, create products/prices matching `billingCatalog` in `lib/stripe.ts`:
   - `explorer` (free tier)
   - `pro` ($X/month)
   - `enterprise` ($X/month)
2. Register a webhook endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.
5. Set `STRIPE_SECRET_KEY` with your live key.

**Verify:** Create a test checkout via Stripe CLI:
```bash
stripe trigger checkout.session.completed
```

**Effort:** Small (1–2 hours).

---

### P1-2: PagerDuty / Slack Alert Routing

**What exists:** 9 Prometheus alert rules at `observability/alerts/alert-rules.yml`. SLO doc at `docs/slos.md` with routing plan (critical → PagerDuty, warning → Slack).

**What to do:**

1. In Grafana Cloud (or your Prometheus/Alertmanager):
   - Import `observability/alerts/alert-rules.yml`
   - Create contact points: PagerDuty integration key, Slack webhook
   - Create notification policies matching the routing in `docs/slos.md`
2. For Slack: Create an incoming webhook in your workspace → `#biozephyra-alerts`
3. For PagerDuty: Create a service, get the integration key.

**Verify:** Trigger a test alert — confirm it arrives in Slack/PagerDuty.

**Effort:** Small (1–2 hours).

---

### P1-3: Import Grafana Dashboards

**What exists:** 5 dashboard JSON files:
- `observability/dashboards/api-overview.json`
- `docs/dashboards/platform-health.json`
- `docs/dashboards/ai-operations.json`
- `docs/dashboards/jobs-outbox.json`
- `docs/dashboards/billing.json`

**What to do:**

1. In Grafana → Dashboards → Import → Upload JSON.
2. Set the Prometheus data source to your OTLP metrics backend.
3. Repeat for all 5 dashboards.

**Verify:** Dashboards populate with real data after staging receives traffic.

**Effort:** Trivial (30 minutes).

---

### P1-4: Wire Playwright E2E Tests into CI

**What exists:** Playwright config at `e2e/playwright.config.ts`, specs `e2e/smoke.spec.ts` and `e2e/auth.spec.ts`. Not executed in any CI workflow.

**What to do:**

1. Add a step to `.github/workflows/ci.yml` after the `Build` step in the `validate` job:
   ```yaml
   - name: Install Playwright browsers
     run: npx playwright install --with-deps chromium

   - name: Run E2E tests
     run: npx playwright test
     env:
       BASE_URL: http://localhost:3000
   ```
2. The Playwright config already has `webServer` auto-start, so it will boot `next dev` for the tests.

**Verify:** CI runs Playwright tests and they pass.

**Effort:** Small (30–60 minutes).

---

### P1-5: SECURITY.md + CSP Hardening

**What exists:** CSP headers in `next.config.mjs` but with `'unsafe-inline' 'unsafe-eval'` for scripts.

**What to do:**

1. Create `SECURITY.md` with:
   - Vulnerability disclosure policy
   - Supported versions
   - Contact email
   - PGP key (optional)
2. Tighten CSP for production:
   - Replace `'unsafe-inline'` with nonce-based CSP (Next.js supports `nonce` via `headers()`)
   - Remove `'unsafe-eval'` (may require adjusting third-party scripts)
   - Keep the current CSP for development via `NODE_ENV` check

**Verify:** `curl -I https://your-domain.com` shows tightened CSP header.

**Effort:** Medium (CSP nonce setup requires testing all pages).

---

## P2 — Within 30 Days of Launch

### P2-1: Data Retention Policies + Purge Automation

**What exists:** Account deletion (`app/api/account/delete/route.ts`), data export (`app/api/account/export/route.ts`), orchestration job retention CronJob (`scripts/orchestration-retention.ts`).

**What to do:**

1. Define retention schedules per data type (consult legal):
   - Audit logs: 1–7 years (compliance-dependent)
   - Biomarker data: indefinite (user-owned) or N days after account deletion
   - AI request logs: 90 days
   - Event bus entries: 30 days
2. Create `scripts/data-retention.ts`:
   ```ts
   // Delete AI audit records older than 90 days
   await db.auditLog.deleteMany({
     where: { action: { startsWith: 'ai.query' }, createdAt: { lt: cutoff90d } }
   })
   // Delete old event bus entries
   // etc.
   ```
3. Add a Helm CronJob (pattern already exists in `charts/orchestration-jobs/`).
4. Add a legal hold flag: `User.legalHold: Boolean @default(false)` — skip deletion when true.

**Verify:** Run the script against staging, verify old records are purged.

**Effort:** Medium (2–4 hours + legal review).

---

### P2-2: Row-Level Security (RLS) for PostgreSQL

**What exists:** Application-level tenant isolation via `scopedDb()` and `assertTenantOwnership()` in `lib/tenancy.ts`. `tenantId` on 32 models.

**What to do:**

1. Create a migration that adds RLS policies:
   ```sql
   ALTER TABLE "Biomarker" ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON "Biomarker"
     USING ("tenantId" = current_setting('app.tenant_id'));
   ```
2. Repeat for all 32 tenant-scoped models.
3. Set `app.tenant_id` per-request in a Prisma `$queryRaw` call:
   ```ts
   await db.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
   ```
4. Create a bypass role for admin/service operations.
5. Test that cross-tenant queries return empty results.

**Verify:** Connect as a non-admin DB role, set a tenant_id, confirm only that tenant's rows are visible.

**Effort:** Medium (4–8 hours, requires careful testing).

---

### P2-3: Cookie Consent Banner

**What exists:** Privacy policy page, GDPR consent management API and UI, consent enforcement on AI routes.

**What to do:**

1. Install a cookie consent library (e.g., `react-cookie-consent` or build a minimal banner component).
2. Wire it into the root layout to show on first visit.
3. Respect consent preferences before setting analytics/marketing cookies.
4. Persist preference via the existing consent API (`POST /api/consent`).

**Verify:** First visit shows banner, accepting sets consent, declining blocks optional cookies.

**Effort:** Small (2–3 hours).

---

### P2-4: docker-compose for Local Development

**What exists:** `Dockerfile`, Helm charts, k8s manifests for Postgres + Kafka.

**What to do:**

Create `docker-compose.yml`:
```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [postgres, redis]
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: Biozephyra
      POSTGRES_USER: Biozephyra
      POSTGRES_PASSWORD: Biozephyra
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes:
  pgdata:
```

**Verify:** `docker compose up` starts the full stack, app connects to Postgres.

**Effort:** Small (1–2 hours).

---

### P2-5: SBOM Generation

**What exists:** Trivy filesystem scan, Dependabot, CodeQL.

**What to do:**

1. Add to CI:
   ```yaml
   - name: Generate SBOM
     uses: aquasecurity/trivy-action@master
     with:
       scan-type: fs
       format: cyclonedx
       output: sbom.cdx.json
   - name: Upload SBOM
     uses: actions/upload-artifact@v4
     with:
       name: sbom
       path: sbom.cdx.json
   ```

**Verify:** CI artifact contains the CycloneDX BOM.

**Effort:** Trivial (15 minutes).

---

## P3 — Post-Launch

### P3-1: SAML 2.0 Identity Provider Support

**What exists:** OIDC SSO, full SCIM 2.0 provisioning.

**What to do:**

1. Install `@boxyhq/saml-jackson` (open-source SAML-to-OIDC bridge).
2. Add a SAML configuration endpoint for IdP metadata upload.
3. Wire into the existing NextAuth OIDC provider (Jackson acts as an OIDC proxy).
4. Test with an Okta dev tenant or Azure AD free tier.

**Verify:** SAML login from an IdP redirects through Jackson → NextAuth → authenticated session.

**Effort:** Medium (4–6 hours).

---

### P3-2: Vault / KMS Secret Management

**What exists:** `scripts/rotate-nextauth-secret.ts` for manual NextAuth secret rotation.

**What to do:**

1. Choose a secrets manager (HashiCorp Vault, AWS Secrets Manager, Doppler).
2. Move all secrets from env vars to the vault.
3. Update deployment scripts to fetch secrets at runtime.
4. Set up automatic rotation for `NEXTAUTH_SECRET` and API keys.

**Verify:** Delete the env var, confirm the app fetches it from vault on startup.

**Effort:** Medium (dependent on provider).

---

### P3-3: Infrastructure as Code (Terraform/Pulumi)

**What exists:** Helm charts, Kustomize overlays, k8s manifests.

**What to do:**

1. Define cloud resources in Terraform/Pulumi:
   - Managed PostgreSQL
   - Redis (Upstash or ElastiCache)
   - Kubernetes cluster (EKS/GKE)
   - Container registry
   - DNS + TLS certificate
   - OTLP backend
2. Use Terraform Cloud or Pulumi Cloud for state management.
3. Wire `terraform apply` into a GitHub Actions deployment workflow.

**Verify:** `terraform plan` shows no drift from the running infrastructure.

**Effort:** Large (8–16 hours for initial setup).

---

### P3-4: Authenticated E2E Test Flows

**What exists:** Playwright smoke and auth specs that test public pages and 401 enforcement.

**What to do:**

1. Create a test user seed script for E2E.
2. Write Playwright specs for:
   - Login → Dashboard → View biomarkers
   - AI Coach query (mocked provider response)
   - Admin role management
   - Marketplace discovery flow
3. Use Playwright's `storageState` for session persistence across specs.

**Verify:** `npx playwright test` completes all authenticated flows in under 60 seconds.

**Effort:** Medium (4–8 hours).

---

### P3-5: Load Testing in CI

**What exists:** k6 scripts (`load-tests/smoke.js`, `baseline.js`, `stress.js`).

**What to do:**

1. Add a CI job:
   ```yaml
   load-test:
     runs-on: ubuntu-latest
     needs: validate
     steps:
       - uses: actions/checkout@v4
       - uses: grafana/k6-action@v0.3.1
         with:
           filename: load-tests/smoke.js
         env:
           BASE_URL: http://localhost:3000
   ```
2. Set pass/fail thresholds in the k6 scripts (already partially defined).

**Verify:** CI fails if p95 latency exceeds threshold.

**Effort:** Small (1 hour).

---

### P3-6: Uptime Monitoring + Status Page

**What to do:**

1. Sign up for UptimeRobot, Pingdom, or Checkly.
2. Add monitors: `GET /api/health` (60-second interval), homepage load.
3. Set up a status page (Statuspage.io, Instatus, or Checkly built-in).
4. Link from the app footer.

**Verify:** Simulated downtime triggers a notification within 2 minutes.

**Effort:** Small (1–2 hours).

---

## Quick Reference: External Accounts Needed

| Service | Purpose | Free Tier? |
|---------|---------|-----------|
| Managed PostgreSQL | Production DB | Neon/Supabase: yes |
| Upstash Redis | Rate limiting, sessions | Yes (10K commands/day) |
| Grafana Cloud | OTLP, dashboards, alerts | Yes (50GB traces/mo) |
| OpenAI / Anthropic / xAI | AI features | Pay-as-you-go |
| Stripe | Billing & marketplace | Yes (test mode) |
| PagerDuty or OpsGenie | Incident alerting | Free for ≤5 users |
| Okta / Azure AD | SSO/SAML testing | Dev tenant free |
| Vercel or Kubernetes | App hosting | Vercel hobby: free |
| UptimeRobot | Uptime monitoring | Yes (50 monitors) |

---

## Implementation Order

```
Week 1:  P0-1 → P0-2 → P0-3 → P0-4 → P0-5
Week 2:  P1-1 → P1-2 → P1-3 → P1-4 → P1-5
Week 3:  P2-1 → P2-2 → P2-3 → P2-4 → P2-5
Week 4+: P3-1 → P3-6 (in any order)
```

Each P0 item takes under 2 hours except P0-5 (staging deploy). If using Vercel for the Next.js app, P0-5 can be done in under an hour.
