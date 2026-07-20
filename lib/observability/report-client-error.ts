/**
 * Best-effort client-side error reporter. Sends React error-boundary crashes to
 * the server log sink so they are actually captured (making "our team has been
 * notified" true). Never throws — a reporting failure must not mask the original
 * error or break the fallback UI.
 */
export function reportClientError(
  error: Error & { digest?: string },
  boundary: "app" | "global",
): void {
  try {
    const body = JSON.stringify({
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      boundary,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    })
    // keepalive so the beacon survives an immediate navigation/reload.
    void fetch("/api/observability/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // swallow — reporting is best-effort
  }
}
