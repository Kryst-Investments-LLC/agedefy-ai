import { afterAll, describe, expect, it } from "vitest"

import { eraseUserResidualPii } from "@/lib/account/erasure"
import { logAudit } from "@/lib/audit"
import { verifyAuditChain } from "@/lib/audit-integrity"
import { db } from "@/lib/db"

const tenantId = `erasure-test-${Date.now()}`
const userId = `${tenantId}-user`

afterAll(async () => {
  await db.idempotencyRecord.deleteMany({ where: { actorUserId: userId } })
  await db.auditLog.deleteMany({ where: { tenantId } })
  await db.user.deleteMany({ where: { id: userId } })
})

describe("account erasure of residual PII (P0-GOV-008)", () => {
  it("purges idempotency records and strips audit email, keeping the hash chain valid", async () => {
    await db.user.create({
      data: { id: userId, email: `${userId}@example.com`, passwordHash: "x", name: "Erasure Test" },
    })

    await logAudit({
      tenantId,
      actorUserId: userId,
      actorEmail: `${userId}@example.com`,
      action: "biomarker.created",
      entityType: "Biomarker",
      entityId: "bm1",
      details: { name: "hsCRP", value: 0.8 },
    })
    await logAudit({
      tenantId,
      actorUserId: userId,
      actorEmail: `${userId}@example.com`,
      action: "consent.granted",
      entityType: "User",
      entityId: userId,
      details: { scopes: ["data-processing"] },
    })

    await db.idempotencyRecord.create({
      data: {
        tenantId,
        route: "/api/biomarkers",
        method: "POST",
        key: `k-${userId}`,
        requestFingerprint: "fp",
        actorUserId: userId,
        status: "COMPLETED",
        responseBody: { name: "hsCRP", value: 0.8 }, // cached PHI
      },
    })

    expect((await verifyAuditChain(tenantId)).valid).toBe(true)

    await eraseUserResidualPii(userId)

    // Idempotency cache (PHI) is gone.
    expect(await db.idempotencyRecord.count({ where: { actorUserId: userId } })).toBe(0)
    // No audit row retains the email.
    const rows = await db.auditLog.findMany({ where: { actorUserId: userId }, select: { actorEmail: true } })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.actorEmail === null)).toBe(true)
    // The tamper-evident chain still verifies (actorEmail is not part of the hash).
    expect((await verifyAuditChain(tenantId)).valid).toBe(true)
  })
})
