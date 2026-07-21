import { trace, metrics, SpanStatusCode, type Span } from "@opentelemetry/api"

const tracer = trace.getTracer("biozephyra")
const meter = metrics.getMeter("biozephyra")

// ─── Counters ────────────────────────────────────────────────

export const aiRequestCounter = meter.createCounter("biozephyra.ai.request.count", {
  description: "Total AI provider requests",
})

export const aiRequestCostHistogram = meter.createHistogram("biozephyra.ai.request.cost_usd", {
  description: "AI provider request cost in USD",
  unit: "usd",
})

export const aiRequestLatencyHistogram = meter.createHistogram("biozephyra.ai.request.latency_ms", {
  description: "AI provider request latency",
  unit: "ms",
})

export const httpRequestDurationHistogram = meter.createHistogram("biozephyra.http.request.duration_ms", {
  description: "HTTP request duration",
  unit: "ms",
})

export const stripeWebhookCounter = meter.createCounter("biozephyra.stripe.webhook.count", {
  description: "Stripe webhook events received",
})

export const outboxDispatchCounter = meter.createCounter("biozephyra.outbox.dispatch.count", {
  description: "Outbox dispatch operations",
})

export const outboxDispatchLatencyHistogram = meter.createHistogram("biozephyra.outbox.dispatch.latency_ms", {
  description: "Outbox dispatch lag: time from event creation to successful publish",
  unit: "ms",
})

export const jobExecutionCounter = meter.createCounter("biozephyra.jobs.execution.count", {
  description: "Orchestration job executions",
})

export const rateLimitBlockedCounter = meter.createCounter("biozephyra.rate_limit.blocked.count", {
  description: "Rate-limited requests",
})

export const circuitBreakerStateChangeCounter = meter.createCounter("biozephyra.circuit_breaker.state_change.count", {
  description: "Circuit breaker state changes",
})

export const rateLimitAbuseCounter = meter.createCounter("biozephyra.rate_limit.abuse.count", {
  description: "Detected rate-limit abuse events (repeated blocks from same source)",
})

export const authFailureCounter = meter.createCounter("biozephyra.auth.failure.count", {
  description: "Failed credential authentication attempts, labeled by reason (credential stuffing signal)",
})

export const candidateTransitionCounter = meter.createCounter("biozephyra.candidate.transition.count", {
  description: "Experiment candidate lifecycle transitions, labeled by from/to status",
})

export const candidateStageDurationHistogram = meter.createHistogram("biozephyra.candidate.stage.duration_ms", {
  description: "Time a candidate spent in a lifecycle stage before advancing out of it",
  unit: "ms",
})

/**
 * Record a candidate lifecycle transition (OBS-004 candidate-workflow SLI): a
 * transition counter labelled by from/to status, plus an optional stage-latency
 * observation (time spent in `fromStatus` before this move). `fromStatus` is
 * null for the initial creation into PROPOSED.
 */
export function recordCandidateTransition(args: {
  fromStatus: string | null
  toStatus: string
  stageDurationMs?: number
}): void {
  candidateTransitionCounter.add(1, {
    from_status: args.fromStatus ?? "none",
    to_status: args.toStatus,
  })
  if (typeof args.stageDurationMs === "number" && args.stageDurationMs >= 0) {
    candidateStageDurationHistogram.record(args.stageDurationMs, { stage: args.fromStatus ?? "none" })
  }
}

// ─── Span Helpers ────────────────────────────────────────────

export function startSpan(name: string, attributes?: Record<string, string | number | boolean>) {
  return tracer.startSpan(name, { attributes })
}

export function endSpanOk(span: Span, attributes?: Record<string, string | number | boolean>) {
  if (attributes) {
    span.setAttributes(attributes)
  }
  span.setStatus({ code: SpanStatusCode.OK })
  span.end()
}

export function endSpanError(span: Span, error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error))
  span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
  span.recordException(err)
  span.end()
}

export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const span = startSpan(name, attributes)
  try {
    const result = await fn(span)
    endSpanOk(span)
    return result
  } catch (error) {
    endSpanError(span, error)
    throw error
  }
}
