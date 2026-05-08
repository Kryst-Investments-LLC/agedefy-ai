function buildFallbackId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizePrefix(prefix: string) {
  const normalized = prefix.trim().replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "")
  return normalized || "mutation"
}

export function createIdempotencyKey(prefix: string) {
  const randomId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : buildFallbackId()

  return `${normalizePrefix(prefix)}-${randomId}`
}

export function withIdempotencyHeaders(init: RequestInit | undefined, prefix: string): RequestInit {
  const method = init?.method?.toUpperCase()

  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return init ?? {}
  }

  const headers = new Headers(init?.headers)
  if (!headers.has("idempotency-key")) {
    headers.set("idempotency-key", createIdempotencyKey(prefix))
  }

  return {
    ...init,
    headers,
  }
}

export function withJsonMutationHeaders(init: RequestInit | undefined, prefix: string): RequestInit {
  const nextInit = withIdempotencyHeaders(init, prefix)
  const headers = new Headers(nextInit.headers)

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  return {
    ...nextInit,
    headers,
  }
}