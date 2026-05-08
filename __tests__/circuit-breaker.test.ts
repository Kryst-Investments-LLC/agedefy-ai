import { afterEach, describe, expect, it } from "vitest"

import { CircuitBreakerOpenError, executeWithCircuitBreaker, resetCircuitBreakerCache } from "@/lib/circuit-breaker"
import { db } from "@/lib/db"

const dependency = "test-circuit-breaker"

async function cleanup() {
  await db.dependencyCircuitBreaker.deleteMany({ where: { dependency } })
  resetCircuitBreakerCache()
}

describe("executeWithCircuitBreaker", () => {
  afterEach(async () => {
    await cleanup()
  })

  it("opens the circuit after repeated failures and blocks subsequent execution", async () => {
    await expect(executeWithCircuitBreaker({
      dependency,
      failureThreshold: 1,
      cooldownMs: 60_000,
      execute: async () => {
        throw new Error("upstream failed")
      },
    })).rejects.toThrow("upstream failed")

    await expect(executeWithCircuitBreaker({
      dependency,
      failureThreshold: 1,
      cooldownMs: 60_000,
      execute: async () => "ok",
    })).rejects.toBeInstanceOf(CircuitBreakerOpenError)

    const record = await db.dependencyCircuitBreaker.findUnique({ where: { dependency } })

    expect(record?.state).toBe("OPEN")
  })

  it("closes the circuit again after a successful half-open retry", async () => {
    await db.dependencyCircuitBreaker.create({
      data: {
        dependency,
        state: "OPEN",
        failureCount: 3,
        nextAttemptAt: new Date(Date.now() - 1_000),
      },
    })

    const result = await executeWithCircuitBreaker({
      dependency,
      failureThreshold: 3,
      cooldownMs: 60_000,
      execute: async () => "ok",
    })

    const record = await db.dependencyCircuitBreaker.findUnique({ where: { dependency } })

    expect(result).toBe("ok")
    expect(record?.state).toBe("CLOSED")
    expect(record?.failureCount).toBe(0)
  })
})