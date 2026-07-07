import { afterEach, describe, expect, it } from "vitest"

import { applyRateLimit, getRateLimitBackend, rateLimit, resolveClientIp, setRateLimitStoreForTests } from "@/lib/rate-limit"

function req(headers: Record<string, string>): Request {
  return new Request("https://example.test/api/demo", { headers })
}

describe("resolveClientIp (anti-spoofing)", () => {
  it("ignores a client-prepended X-Forwarded-For entry", () => {
    // Attacker prepends a fake IP; the trusted proxy appends the real one last.
    expect(resolveClientIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9")
  })

  it("does not let a spoofed leftmost entry mint a fresh bucket", () => {
    const a = resolveClientIp(req({ "x-forwarded-for": "9.9.9.9, 203.0.113.9" }))
    const b = resolveClientIp(req({ "x-forwarded-for": "8.8.8.8, 203.0.113.9" }))
    expect(a).toBe(b) // same real client → same rate-limit key
  })

  it("uses the single entry when only one hop is present", () => {
    expect(resolveClientIp(req({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9")
  })

  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(resolveClientIp(req({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7")
    expect(resolveClientIp(req({}))).toBe("unknown")
  })
})

describe("rateLimit", () => {
  afterEach(() => {
    setRateLimitStoreForTests(null)
  })

  it("allows requests under the limit", () => {
    const key = `test-allow-${Date.now()}`
    const result = rateLimit(key, { maxRequests: 5, windowMs: 60_000 })
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it("tracks remaining requests accurately", () => {
    const key = `test-remaining-${Date.now()}`
    rateLimit(key, { maxRequests: 3, windowMs: 60_000 })
    rateLimit(key, { maxRequests: 3, windowMs: 60_000 })
    const third = rateLimit(key, { maxRequests: 3, windowMs: 60_000 })
    expect(third.success).toBe(true)
    expect(third.remaining).toBe(0)
  })

  it("blocks requests over the limit", () => {
    const key = `test-block-${Date.now()}`
    const opts = { maxRequests: 2, windowMs: 60_000 }
    rateLimit(key, opts)
    rateLimit(key, opts)
    const result = rateLimit(key, opts)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("uses separate buckets per key", () => {
    const keyA = `test-a-${Date.now()}`
    const keyB = `test-b-${Date.now()}`
    const opts = { maxRequests: 1, windowMs: 60_000 }

    rateLimit(keyA, opts) // use up keyA
    const resultA = rateLimit(keyA, opts)
    const resultB = rateLimit(keyB, opts)

    expect(resultA.success).toBe(false) // keyA exhausted
    expect(resultB.success).toBe(true)  // keyB still fresh
  })

  it("keeps the local helper on the in-memory backend", () => {
    expect(rateLimit(`test-backend-${Date.now()}`).store).toBe("memory")
  })

  it("reports the active backend", () => {
    expect(["memory", "redis"]).toContain(getRateLimitBackend())
  })

  it("returns null when the async limiter allows the request", async () => {
    setRateLimitStoreForTests({
      kind: "test",
      increment: async () => ({
        success: true,
        remaining: 2,
        resetAt: Date.now() + 60_000,
        limit: 3,
        store: "test",
      }),
    })

    const response = await applyRateLimit(new Request("https://example.test/api/demo"))

    expect(response).toBeNull()
  })

  it("returns a 429 response with backend metadata when blocked", async () => {
    setRateLimitStoreForTests({
      kind: "test",
      increment: async () => ({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 5_000,
        limit: 2,
        store: "test",
      }),
    })

    const response = await applyRateLimit(new Request("https://example.test/api/demo"))

    expect(response?.status).toBe(429)
    expect(response?.headers.get("X-RateLimit-Remaining")).toBe("0")
    expect(response?.headers.get("X-RateLimit-Limit")).toBe("2")
    expect(response?.headers.get("X-RateLimit-Backend")).toBe("test")
  })
})
