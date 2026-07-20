# Service Level Objectives (P0-OBS-004)

SLIs/SLOs for the Biozephyra platform, each mapped to the metric **actually
emitted** by `lib/observability/telemetry.ts` (OpenTelemetry names use dots;
the Prometheus exporter renders them with underscores and a `biozephyra_`
prefix, e.g. `biozephyra.http.request.duration_ms` →
`biozephyra_http_request_duration_ms_{count,bucket,sum}`). Alerts that back
these SLOs live in [`alerts/alert-rules.yml`](alerts/alert-rules.yml); dashboards
in [`dashboards/`](dashboards/).

The **Backed by** column is the honest current state:
- ✅ emitted — the metric exists today and the SLO is measurable now.
- ⚠️ gap — the SLO is defined but the metric is not yet emitted; the alert is
  written against the intended name and is inert until instrumentation lands
  (tracked in the OBS section of `PRODUCTION-GRADE-TODO.md`).

Targets are steady-state goals over a rolling 30-day window unless noted.
Error-budget policy: burning >10% of the monthly budget in 1 hour pages P1
(fast burn); sustained breach of the steady-state target pages at the listed
severity.

## API success (availability)

| Field | Value |
|-------|-------|
| SLI | Fraction of HTTP responses that are **not** 5xx |
| Metric | `biozephyra_http_request_duration_ms_count` (labels `route`, `method`, `http_status_code`) |
| Query | `1 - sum(rate(…count{http_status_code=~"5.."}[5m])) / sum(rate(…count[5m]))` |
| SLO | ≥ 99.0% success (≤ 1% 5xx) over 5m; monthly availability ≥ 99.5% |
| Alert / sev | `ApiErrorRateHigh` (P1), `ErrorBudgetBurnFast` (P1) |
| Backed by | ✅ emitted (`withHttpMetrics`; adopted on the AI routes, extend via a shared route factory) |

## API latency

| Field | Value |
|-------|-------|
| SLI | P99 request duration for non-AI, non-health routes |
| Metric | `biozephyra_http_request_duration_ms_bucket` |
| Query | `histogram_quantile(0.99, rate(…bucket{route!~"/api/ai/.*|/api/health"}[10m]))` |
| SLO | P99 ≤ 500ms |
| Alert / sev | `ApiLatencyP99High` (P2) |
| Backed by | ✅ emitted |

## AI provider latency

| Field | Value |
|-------|-------|
| SLI | P95 end-to-end latency of a governed AI provider call |
| Metric | `biozephyra_ai_request_latency_ms_bucket` (label `provider`) |
| Query | `histogram_quantile(0.95, rate(…bucket[10m]))` |
| SLO | P95 ≤ 5s |
| Alert / sev | `AiProviderLatencyP95High` (P2) |
| Backed by | ✅ emitted (openai/anthropic/grok routes) |

## Authentication

| Field | Value |
|-------|-------|
| SLI | Credential-auth failure rate, and absence of an anomalous failure spike |
| Metric | `biozephyra_auth_failure_count` (label `reason`) |
| Query | `sum(rate(…[5m])) by (reason)` — alert on sustained spike relative to baseline |
| SLO | No sustained failure-rate spike > 5× the 7-day baseline (credential-stuffing signal) |
| Alert / sev | (to add — see gap note) P2 |
| Backed by | ✅ emitted (counter incremented at every `authorize` failure with a `reason`) |

## Payments (Stripe)

| Field | Value |
|-------|-------|
| SLI | Stripe webhook processing success rate |
| Metric | `biozephyra_stripe_webhook_count` (labels `event_type`, `livemode`, `outcome` = success/failed/duplicate) |
| Query | `sum(rate(…{outcome="success"}[15m])) / sum(rate(…{outcome=~"success|failed"}[15m]))` (duplicates excluded) |
| SLO | ≥ 99.5% of processed webhooks succeed (persisted + side-effects) without a terminal failure |
| Alert / sev | (to add) P1 on success ratio < 0.99 for 15m |
| Backed by | ✅ emitted — counter now records the terminal `outcome` per webhook at each return path |

## Data ingestion (canonical event outbox)

| Field | Value |
|-------|-------|
| SLI | Outbox dispatch throughput/success, and dispatch lag |
| Metric | `biozephyra_outbox_dispatch_count` (labels `status` = published/retry/dead_letter, `topic`); `biozephyra_outbox_dispatch_latency_ms_bucket` (label `topic`, creation→publish) |
| Query | success ratio `sum(rate(…count{status="published"}[15m])) / sum(rate(…count[15m]))`; lag `histogram_quantile(0.95, rate(…latency_ms_bucket[15m]))` |
| SLO | ≥ 99% dispatched successfully; P95 dispatch lag ≤ 60s |
| Alert / sev | `OutboxDispatchDelayed` (P2) |
| Backed by | ✅ emitted (count + latency histogram) |

## Job age (orchestration queue)

| Field | Value |
|-------|-------|
| SLI | Age of the oldest due-and-queued orchestration job |
| Metric | `biozephyra_orchestration_job_oldest_queued_age_ms` (observable gauge, 0 when empty) |
| Query | `max(biozephyra_orchestration_job_oldest_queued_age_ms)` |
| SLO | Oldest queued job ≤ 5 minutes (300000 ms) |
| Alert / sev | `JobQueueStale` (P2) |
| Backed by | ✅ emitted — registered at OTel init (`registerJobQueueAgeGauge`); callback runs a cheap indexed query on metric collection |

## Candidate workflow completion

| Field | Value |
|-------|-------|
| SLI | Fraction of candidates that progress through the research lifecycle without stalling; time-in-stage |
| Metric | ⚠️ not emitted — no per-stage transition counter/histogram today |
| Query | (pending) transition counter labelled by `from_status`/`to_status` + a stage-latency histogram |
| SLO | ≥ 95% of candidates advance past triage within the target stage SLA; no stage stalls > N days |
| Alert / sev | (pending instrumentation) |
| Backed by | ⚠️ gap — add candidate lifecycle metrics (pairs with OBS-009 tracing) |

## Supporting reliability signals (not user SLOs, but alerted)

| Signal | Metric | Alert / sev | Backed by |
|--------|--------|-------------|-----------|
| Circuit breaker opened | `biozephyra_circuit_breaker_state_change_count{state="open"}` | `CircuitBreakerOpen` (P1) | ✅ emitted |
| Rate-limit abuse | `biozephyra_rate_limit_abuse_count` | `RateLimitAbuseDetected` (P3) | ✅ emitted |
| DB pool saturation | `prisma_pool_active_connections / prisma_pool_max_connections` | `DbPoolHighUtilization` (P1) | ⚠️ gap — emit pool gauges |

## Instrumentation gaps to close (OBS follow-ups)

1. ~~`outbox_dispatch_latency_ms` histogram~~ — **done** (`biozephyra_outbox_dispatch_latency_ms`).
2. ~~Stripe `outcome` label for the payments success SLO~~ — **done**.
3. ~~Job-queue-age gauge~~ — **done** (`biozephyra_orchestration_job_oldest_queued_age_ms`).
4. `prisma_pool_active_connections` / `_max_connections` gauges (DB-pool alert).
5. Candidate lifecycle transition counter + stage-latency histogram.
6. Extend `withHttpMetrics` to non-AI routes via a shared route factory so the
   API-success/latency SLOs cover the whole surface, not just the AI routes.
