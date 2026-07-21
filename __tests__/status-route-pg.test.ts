import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import { GET } from "@/app/api/status/route"
import { resetCircuitBreakerCache } from "@/lib/circuit-breaker"

const ALL_DEPS = [
  "openai-api",
  "anthropic-api",
  "grok-api",
  "stripe-billing-write",
  "stripe-marketplace-confirmation",
  "chembl-api",
  "pubchem-api",
  "rcsb-files",
  "rcsb-metadata",
  "aeonforge-discovery",
]

async function clean() {
  await db.dependencyCircuitBreaker.deleteMany({ where: { dependency: { in: ALL_DEPS } } })
  resetCircuitBreakerCache()
}

async function status() {
  return (await GET()).json()
}

describe("GET /api/status degraded categories (INT-008)", () => {
  beforeEach(clean)
  afterEach(clean)

  it("is not degraded when no breaker is open", async () => {
    const body = await status()
    expect(body.degraded).toBe(false)
    expect(body.degradedLabels).toEqual([])
    expect(body.categories).toHaveLength(3)
  })

  it("flags the payments category when a stripe breaker is OPEN", async () => {
    await db.dependencyCircuitBreaker.create({ data: { dependency: "stripe-billing-write", state: "OPEN" } })
    const body = await status()
    expect(body.degraded).toBe(true)
    expect(body.degradedLabels).toContain("Payments")
    expect(body.degradedLabels).not.toContain("AI features")
  })

  it("flags research-data when an external chemistry breaker is OPEN", async () => {
    await db.dependencyCircuitBreaker.create({ data: { dependency: "pubchem-api", state: "OPEN" } })
    const body = await status()
    expect(body.degraded).toBe(true)
    expect(body.degradedLabels).toContain("Compound & structure data")
  })

  it("treats HALF_OPEN as available (probing recovery)", async () => {
    await db.dependencyCircuitBreaker.create({ data: { dependency: "openai-api", state: "HALF_OPEN" } })
    const body = await status()
    expect(body.degraded).toBe(false)
  })
})
