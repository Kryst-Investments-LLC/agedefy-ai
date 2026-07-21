import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import { GET } from "@/app/api/ai/status/route"
import { resetCircuitBreakerCache } from "@/lib/circuit-breaker"

const AI_DEPS = ["openai-api", "anthropic-api", "grok-api"]

async function clean() {
  await db.dependencyCircuitBreaker.deleteMany({ where: { dependency: { in: AI_DEPS } } })
  resetCircuitBreakerCache()
}

describe("GET /api/ai/status degraded-state (INT-008)", () => {
  beforeEach(clean)
  afterEach(clean)

  it("is not degraded when no provider circuit is open", async () => {
    const body = await (await GET()).json()
    expect(body.degraded).toBe(false)
    expect(body.providers).toHaveLength(3)
    expect(body.providers.every((p: { available: boolean }) => p.available)).toBe(true)
  })

  it("is degraded with the specific provider unavailable when its circuit is OPEN", async () => {
    await db.dependencyCircuitBreaker.create({ data: { dependency: "openai-api", state: "OPEN" } })

    const body = await (await GET()).json()
    expect(body.degraded).toBe(true)
    expect(body.providers.find((p: { provider: string }) => p.provider === "openai").available).toBe(false)
    // A provider with no row has never tripped → available.
    expect(body.providers.find((p: { provider: string }) => p.provider === "anthropic").available).toBe(true)
  })

  it("treats HALF_OPEN as available (probing recovery)", async () => {
    await db.dependencyCircuitBreaker.create({ data: { dependency: "grok-api", state: "HALF_OPEN" } })

    const body = await (await GET()).json()
    expect(body.degraded).toBe(false)
    expect(body.providers.find((p: { provider: string }) => p.provider === "grok").available).toBe(true)
  })
})
