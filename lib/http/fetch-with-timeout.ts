/**
 * fetch() with a hard timeout so an unresponsive upstream can't hang the caller.
 * Aborts after `timeoutMs` (default 15s) and rejects with a TimeoutError. A
 * caller-supplied `init.signal` is honored too — aborting either the timeout or
 * the caller's signal aborts the request. Works on any Node (no AbortSignal.any
 * / AbortSignal.timeout dependency).
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, "TimeoutError"))
  }, timeoutMs)

  const callerSignal = init.signal
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason)
    else callerSignal.addEventListener("abort", () => controller.abort(callerSignal.reason), { once: true })
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
