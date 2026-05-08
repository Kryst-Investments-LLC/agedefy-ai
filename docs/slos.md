# Biozephyra — Service Level Objectives

## SLO Definitions

### 1. API Availability
- **Target**: 99.9% (non-5xx responses for authenticated routes)
- **Window**: 30-day rolling
- **Error budget**: 43.2 minutes/month
- **Measurement**: `1 - (sum(rate(http_status_5xx[30d])) / sum(rate(http_requests_total[30d])))`

### 2. AI Route Latency
- **Target**: p95 < 10,000ms
- **Window**: 1-hour rolling
- **Measurement**: `histogram_quantile(0.95, sum(rate(biozephyra_ai_request_latency_ms_bucket[1h])) by (le))`
- **Rationale**: AI provider calls involve network round-trips; 10s p95 accounts for slower models.

### 3. Webhook Processing
- **Target**: 99.5% success within 30s of receipt
- **Window**: 24-hour rolling
- **Measurement**: Stripe webhook events processed without error / total received
- **Excludes**: Duplicate webhooks (already-handled idempotent replays)

### 4. Job Execution
- **Target**: 99% complete within 2× expected duration
- **Window**: 24-hour rolling
- **Measurement**: `jobs_completed_on_time / jobs_total`
- **Expected durations by queue**:
  - GOVERNANCE: 5s
  - INGESTION: 30s
  - NOTIFICATION: 10s
  - DEFAULT: 15s

---

## Alerting Rules

### Critical (page immediately)

| Alert | Condition | Duration |
|-------|-----------|----------|
| High Error Rate | Error rate > 5% over 5 min | 5m |
| Dead Letter Queue | Dead-letter count > 10 | instant |
| Outbox Stall | Zero successful outbox dispatches in 1 hour | 60m |
| Database Unreachable | Prisma connection errors > 0 for 2 min | 2m |

### Warning (notify Slack/email)

| Alert | Condition | Duration |
|-------|-----------|----------|
| Elevated Error Rate | Error rate > 1% over 5 min | 5m |
| AI Circuit Breaker Open | Any circuit breaker in OPEN state | instant |
| Rate Limit Abuse | `biozephyra_rate_limit_abuse_count` > 0 in 5 min | 5m |
| AI Latency Degradation | AI p95 > 15s for 10 min | 10m |
| Job Backlog | Pending jobs > 100 for 10 min | 10m |

### Informational (log only)

| Alert | Condition | Duration |
|-------|-----------|----------|
| AI Cost Spike | Hourly AI cost > $10 | 60m |
| New Dead Letter | Single job dead-lettered | instant |

---

## Alert Routing

```yaml
# Grafana alerting contact points (configure in Grafana UI):
#
# critical -> PagerDuty / Opsgenie integration
# warning  -> Slack #biozephyra-alerts channel
# info     -> Slack #biozephyra-observability channel
#
# On-call rotation: weekly, 2-person primary/secondary
# Escalation: primary (5 min) -> secondary (10 min) -> engineering lead (15 min)
```

---

## Grafana Alert Rule Examples (PromQL)

```yaml
# Critical: High Error Rate
- alert: HighErrorRate
  expr: |
    sum(rate(biozephyra_http_request_duration_ms_count{http_status_code=~"5.."}[5m]))
    / sum(rate(biozephyra_http_request_duration_ms_count[5m])) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "API error rate exceeds 5%"

# Critical: Dead Letter Queue
- alert: DeadLetterQueueHigh
  expr: sum(increase(biozephyra_jobs_execution_count{status="dead_lettered"}[1h])) > 10
  labels:
    severity: critical
  annotations:
    summary: "More than 10 dead-lettered jobs in the last hour"

# Critical: Outbox Stall
- alert: OutboxStall
  expr: sum(increase(biozephyra_outbox_dispatch_count{status="success"}[1h])) == 0
  labels:
    severity: critical
  annotations:
    summary: "No successful outbox dispatches in the last hour"

# Warning: AI Circuit Breaker Open
- alert: AICircuitBreakerOpen
  expr: biozephyra_circuit_breaker_state_change_count{state="OPEN"} > 0
  labels:
    severity: warning
  annotations:
    summary: "Circuit breaker opened for {{ $labels.dependency }}"

# Warning: Elevated Error Rate
- alert: ElevatedErrorRate
  expr: |
    sum(rate(biozephyra_http_request_duration_ms_count{http_status_code=~"5.."}[5m]))
    / sum(rate(biozephyra_http_request_duration_ms_count[5m])) > 0.01
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "API error rate exceeds 1%"
```
