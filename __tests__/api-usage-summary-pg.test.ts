import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import { getUserUsageSummary } from "@/lib/api-keys/metering"

const userId = "usage-summary-user"
const keyA = "usage-key-a"
const keyB = "usage-key-b"

describe("getUserUsageSummary single-query aggregation (P1-PERF-012)", () => {
  beforeAll(async () => {
    await db.user.create({
      data: { id: userId, email: `${userId}@example.com`, passwordHash: "x", name: userId },
    })
    await db.aPIKey.createMany({
      data: [
        { id: keyA, userId, name: "Key A", prefix: "ak_aaaaa", keyHash: `hash-${keyA}` },
        { id: keyB, userId, name: "Key B", prefix: "ak_bbbbb", keyHash: `hash-${keyB}` },
      ],
    })
    await db.aPIUsageRecord.createMany({
      data: [
        { keyId: keyA, endpoint: "/v1/discover", statusCode: 200, tokens: 10, computeMs: 100 },
        { keyId: keyA, endpoint: "/v1/discover", statusCode: 200, tokens: 20, computeMs: 200 },
        { keyId: keyA, endpoint: "/v1/simulate", statusCode: 200, tokens: 5, computeMs: 50 },
        { keyId: keyB, endpoint: "/v1/discover", statusCode: 200, tokens: 7, computeMs: 70 },
      ],
    })
  })

  afterAll(async () => {
    await db.aPIUsageRecord.deleteMany({ where: { keyId: { in: [keyA, keyB] } } })
    await db.aPIKey.deleteMany({ where: { id: { in: [keyA, keyB] } } })
    await db.user.deleteMany({ where: { id: userId } })
  })

  it("aggregates per key and per endpoint from one grouped query", async () => {
    const summaries = await getUserUsageSummary(userId, new Date(0))
    const byId = new Map(summaries.map((s) => [s.keyId, s]))

    const a = byId.get(keyA)!.usage
    expect(a.totalCalls).toBe(3)
    expect(a.totalTokens).toBe(35)
    expect(a.totalComputeMs).toBe(350)
    expect(a.byEndpoint).toEqual({ "/v1/discover": 2, "/v1/simulate": 1 })

    const b = byId.get(keyB)!.usage
    expect(b.totalCalls).toBe(1)
    expect(b.totalTokens).toBe(7)
    expect(b.byEndpoint).toEqual({ "/v1/discover": 1 })
  })

  it("returns a zeroed summary for a key with no usage in the window", async () => {
    const summaries = await getUserUsageSummary(userId, new Date(Date.now() + 60_000)) // future window
    const a = summaries.find((s) => s.keyId === keyA)!.usage
    expect(a.totalCalls).toBe(0)
    expect(a.byEndpoint).toEqual({})
  })
})
