# Durable Job Orchestration Runbook

## Scope

This runbook covers the durable orchestration subsystem for AI, ingestion, notification, and governance workloads.

## Queues

- `AI`: asynchronous governance audit and model oversight follow-ups.
- `INGESTION`: deferred research/evidence materialization and downstream enrichment.
- `NOTIFICATION`: durable user/admin notification delivery.
- `GOVERNANCE`: review escalations and dead-letter remediation.

## Runtime Commands

- Start a worker: `pnpm jobs:worker`
- Run one dispatch batch: `pnpm jobs:dispatch`
- Run retention cleanup: `pnpm jobs:retention`

## Deployment Target

- Helm chart: `charts/orchestration-jobs`
- Worker runtime: Kubernetes `Deployment` running `pnpm jobs:worker`
- Retention runtime: Kubernetes `CronJob` running `pnpm jobs:retention`
- Migration runtime: Helm post-install/post-upgrade hook job running `pnpm db:deploy:postgres`
- The base image now defaults to the orchestration worker command; the chart overrides the retention command for the scheduled cleanup job.
- Release workflow: `.github/workflows/helm-release.yml` deploys both `charts/outbox-dispatch` and `charts/orchestration-jobs`.
- Required release secrets/vars: `KUBE_CONFIG_DATA`, `DATABASE_URL` or `POSTGRES_DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `REDIS_URL`, `REDIS_TOKEN`, and `OTEL_EXPORTER_OTLP_ENDPOINT` secrets plus `KUBE_NAMESPACE`, `APP_DATABASE_SECRET_NAME`, `OUTBOX_SECRET_NAME`, `IMAGE_REPOSITORY`, `ORCHESTRATION_RELEASE_NAME`, `OUTBOX_RELEASE_NAME`, and optionally `OTEL_SERVICE_NAME` vars.

## Required Environment Variables

- `JOB_WORKER_BATCH_SIZE`
- `JOB_WORKER_POLL_INTERVAL_MS`
- `JOB_WORKER_MAX_ATTEMPTS`
- `JOB_WORKER_RETRY_DELAY_MS`
- `JOB_WORKER_LEASE_MS`
- `JOB_RETENTION_HOURS`
- `JOB_TENANT_ID` for tenant-scoped worker execution when needed

## Operational Checks

1. Call `/api/health` and verify `orchestration` metrics are present.
2. Call `/api/admin/jobs` as an admin to inspect queue depth and dead-letter jobs.
3. Call `/api/admin/jobs/summary` as an admin for queue-by-queue backlog, in-flight, and dead-letter totals with oldest backlog/dead-letter timestamps.
4. Create tenant-scoped orchestration jobs for supported workload families with `POST /api/admin/jobs`.
5. Retry a dead-letter job with `/api/admin/jobs/{id}/retry` after the root cause is fixed.
6. Cancel a queued or in-flight job with `/api/admin/jobs/{id}/cancel` when the downstream workflow should no longer execute.
7. Review generated `ReviewItem` records for dead-lettered governance-sensitive jobs.

## Failure Modes

- Notification dispatch failures remain durable and retry automatically until dead-lettered.
- AI governance audit failures create review items once the job is dead-lettered.
- Ingestion materialization failures keep the source collection intact and can be retried safely.

## Retention

- Terminal jobs are retained until `retainedUntil`.
- Run `pnpm jobs:retention` on a schedule to purge expired terminal jobs.

## Integration Notes

- `POST /api/research/ingest` now queues evidence materialization and returns `202` with `orchestrationJobId`.
- `notifyMarketplaceUser` now persists the notification first and queues durable delivery.
- `POST /api/ai/openai`, `POST /api/ai/anthropic`, and `POST /api/ai/grok` now queue governed audit follow-up instead of writing the audit inline.
- `POST /api/admin/jobs` accepts validated enqueue requests for `ai.governance.audit`, `ingestion.research.materialize`, `notification.marketplace.dispatch`, and `governance.review.escalation`.

## Prisma Baseline

- The repo now contains a committed baseline migration under `prisma/migrations/20260327221500_baseline`.
- The repo now also contains a committed PostgreSQL baseline migration under `prisma/migrations-postgres/20260401150000_baseline`.
- Existing local databases should run `pnpm db:resolve --applied 20260327221500_baseline` once after syncing the schema so future `pnpm db:migrate` runs operate from committed history.
- CI and release automation now use committed migration paths instead of `pnpm db:push`, and the Postgres-backed release path runs `pnpm db:deploy:postgres`.