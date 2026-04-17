# Production Operations Runbook

## Scope

This runbook covers the staging and production runtime baseline for Biozephyra, the Postgres-backed validation path, and the minimum operator response flow for incidents, observability gaps, and database recovery.

## Required Runtime Baseline

Set these environment variables for staging and production deployments:

- `APP_ENV=staging` or `APP_ENV=production`
- `RUNTIME_REQUIREMENTS_ENFORCED=true`
- `DATABASE_URL` pointing at PostgreSQL
- `REDIS_URL`
- `REDIS_TOKEN`
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

The runtime baseline is enforced in three places:

- `pnpm validate:runtime`
- `/api/health`, which returns `503` with a populated `runtime.issues` array when an enforced deployment is missing a required control
- `lib/rate-limit.ts`, which refuses to silently fall back to in-memory rate limiting when the enforced baseline is active

## Prisma And Database Commands

- Local dev/test SQLite client: `pnpm db:generate`
- Runtime-aware client generation: `pnpm db:generate:runtime`
- Postgres runtime client generation: `pnpm db:generate:postgres:runtime`
- Postgres migrations: `pnpm db:deploy:postgres`
- Runtime baseline validation: `pnpm validate:runtime`
- Full platform smoke: `pnpm smoke:platform`

The committed PostgreSQL migration baseline lives under `prisma/migrations-postgres`.

## CI And Staging Validation

- `.github/workflows/ci.yml` runs a Postgres-backed smoke job on every push and pull request.
- `.github/workflows/staging-platform-validation.yml` can run the same smoke harness against a deployed staging environment on a nightly schedule or manually.

Required staging validation secrets:

- `STAGING_DATABASE_URL`
- `STAGING_NEXTAUTH_URL`
- `STAGING_NEXTAUTH_SECRET`
- `STAGING_REDIS_URL`
- `STAGING_REDIS_TOKEN`
- `STAGING_OTEL_EXPORTER_OTLP_ENDPOINT`
- `STAGING_SMOKE_BASE_URL`

Optional staging validation variables:

- `STAGING_VALIDATION_ENABLED=true` to allow the scheduled workflow to execute
- `STAGING_OTEL_SERVICE_NAME` to override the default service label

Bootstrap helper:

```powershell
pwsh -File tools/set-staging-validation-secrets.ps1 \
	-StagingUrl https://your-app.vercel.app \
	-DatabaseUrl "postgresql://user:password@host/database?schema=public" \
	-NextAuthSecret "replace-with-a-32-char-secret" \
	-RedisUrl https://your-upstash-instance.upstash.io \
	-RedisToken "replace-with-your-upstash-token" \
	-OtelExporterOtlpEndpoint https://otel.example.com/v1/traces
```

The helper sets the required `STAGING_*` secrets and enables `STAGING_VALIDATION_ENABLED=true` unless you pass `-SkipEnableSchedule`.

You do not need a custom domain for staging. A stable provider-generated HTTPS hostname is sufficient. In most hosted setups:

- `STAGING_NEXTAUTH_URL` should be the base URL of the deployed staging app
- `STAGING_SMOKE_BASE_URL` should be the same value as `STAGING_NEXTAUTH_URL`

Examples:

- `https://your-app.vercel.app`
- `https://your-app.up.railway.app`
- `https://your-app.onrender.com`

Do not point scheduled GitHub Actions smoke runs at `localhost`, a transient tunnel, or a machine-local IP.

## Health And Readiness Checks

Run these checks before and after a deploy:

1. Call `/api/health` and verify `status=healthy`.
2. Confirm `runtime.databaseProvider` is `postgresql`.
3. Confirm `runtime.rateLimitBackend` is `redis`.
4. Confirm `runtime.observability.otelConfigured` is `true`.
5. Confirm `runtime.issues` is empty.
6. Confirm `orchestration` metrics are present and queue depth is within the expected range.

## Alerting Expectations

The live observability implementation is still partial, but the baseline alerts that should exist for staging and production are:

- sustained `5xx` or health-check failures
- degraded `runtime.issues` state from `/api/health`
- API latency regression at the route and dependency level
- durable-job backlog growth, dead-letter growth, or worker lease churn
- Stripe webhook failure spikes
- auth denial spikes for privileged routes
- AI provider failure-rate or cost anomalies

## Incident Response

Use this response order for severity-one and severity-two incidents:

1. Freeze deployments and collect the failing `/api/health` payload, worker logs, and the last successful smoke-validation run.
2. Determine whether the failure is baseline-related, dependency-related, or data-related.
3. If the issue is deploy-induced, roll back to the last known-good image and rerun `/api/health` plus the smoke harness.
4. If the issue is dependency-related, engage the circuit-breaker or provider failover path where available and reduce non-critical background load.
5. If the issue is data-related, stop write-heavy workflows, snapshot the affected database, and execute the restore plan below.
6. Record the incident timeline, impact, and remediation actions before closing the event.

## Backup And Restore

The production database strategy is PostgreSQL-first. The minimum operating standard is:

- daily logical backups or managed-service automated backups
- point-in-time recovery enabled where the provider supports it
- encrypted backup storage with restricted operator access
- a documented restore target for staging rehearsal

Restore flow:

1. Put the affected environment into maintenance mode or stop traffic at the load-balancer layer.
2. Restore the latest safe Postgres backup into a clean recovery instance.
3. Validate schema state with `pnpm db:deploy:postgres` against the recovery instance.
4. Run `pnpm validate:runtime` and `pnpm smoke:platform` against the restored target.
5. Swap traffic only after health, smoke, and queue-depth checks are green.
6. Preserve the failed instance or snapshot until postmortem review is complete.

## Related Runbooks

- `docs/job-orchestration-runbook.md`
- `docs/LEVEL4-READINESS-GAP-AND-RISK-ACCEPTANCE.md`
- `docs/COMPLIANCE-AND-MEDICAL-CLAIM-REVIEW.md`