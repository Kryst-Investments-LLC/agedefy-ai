import { httpRequestDurationHistogram } from "@/lib/observability/telemetry"

type RouteHandler<A extends unknown[]> = (...args: A) => Promise<Response>

/**
 * Wrap an API route handler to record request duration + status into
 * httpRequestDurationHistogram (previously declared but never emitted). Labels
 * match what observability/alerts/alert-rules.yml queries: `route`, `method`,
 * and `http_status_code`. A thrown handler is recorded as 500 and re-thrown.
 *
 * Usage:
 *   export const POST = withHttpMetrics("/api/ai/openai", async (request) => { ... })
 */
export function withHttpMetrics<A extends unknown[]>(
  route: string,
  handler: RouteHandler<A>,
): RouteHandler<A> {
  return async (...args: A): Promise<Response> => {
    const start = performance.now()
    const method =
      typeof args[0] === "object" && args[0] !== null && "method" in args[0]
        ? String((args[0] as { method?: unknown }).method ?? "UNKNOWN")
        : "UNKNOWN"
    let httpStatusCode = 500
    try {
      const response = await handler(...args)
      httpStatusCode = response.status
      return response
    } finally {
      httpRequestDurationHistogram.record(performance.now() - start, {
        route,
        method,
        http_status_code: httpStatusCode,
      })
    }
  }
}
