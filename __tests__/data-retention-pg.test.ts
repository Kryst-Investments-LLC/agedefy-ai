import { afterAll, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import { purgeExpiredTransientData } from "@/lib/retention/data-retention"

const tag = `retention-test-${Date.now()}`

afterAll(async () => {
  await db.idempotencyRecord.deleteMany({ where: { tenantId: tag } })
  await db.verificationToken.deleteMany({ where: { identifier: { startsWith: tag } } })
})

describe("data retention purge (P0-SEC-011)", () => {
  it("deletes expired idempotency records + verification tokens, keeps live ones", async () => {
    const past = new Date(Date.now() - 60_000)
    const future = new Date(Date.now() + 60_000)

    await db.idempotencyRecord.createMany({
      data: [
        { tenantId: tag, route: "/x", method: "POST", key: "expired", requestFingerprint: "f1", status: "COMPLETED", expiresAt: past },
        { tenantId: tag, route: "/x", method: "POST", key: "live", requestFingerprint: "f2", status: "COMPLETED", expiresAt: future },
        { tenantId: tag, route: "/x", method: "POST", key: "noexpiry", requestFingerprint: "f3", status: "COMPLETED", expiresAt: null },
      ],
    })
    await db.verificationToken.createMany({
      data: [
        { identifier: `${tag}-expired`, token: `${tag}-t1`, expires: past },
        { identifier: `${tag}-live`, token: `${tag}-t2`, expires: future },
      ],
    })

    const result = await purgeExpiredTransientData()
    expect(result.idempotencyRecordsDeleted).toBeGreaterThanOrEqual(1)

    // Only the expired idempotency record is gone; live + no-expiry remain.
    const remaining = await db.idempotencyRecord.findMany({ where: { tenantId: tag }, select: { key: true } })
    expect(remaining.map((r) => r.key).sort()).toEqual(["live", "noexpiry"])

    // Expired token gone, live token remains.
    const tokens = await db.verificationToken.findMany({
      where: { identifier: { startsWith: tag } },
      select: { identifier: true },
    })
    expect(tokens.map((t) => t.identifier)).toEqual([`${tag}-live`])
  })
})
