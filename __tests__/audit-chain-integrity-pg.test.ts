import { afterAll, describe, expect, it } from "vitest"

import { logAudit } from "@/lib/audit"
import { verifyAuditChain } from "@/lib/audit-integrity"
import { db } from "@/lib/db"

// Real-Postgres round-trip: write audit entries that carry `details` (a Json
// column) through logAudit, then verify the hash chain. This exercises the
// write -> Prisma Json store -> read -> verify path where the serialization bug
// lived (verify re-JSON.stringify'd the round-tripped string, so every entry
// with details produced a false brokenLink). A pure computeEntryHash unit test
// cannot catch it.
const tenantId = `audit-chain-test-${Date.now()}`

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { tenantId } })
})

describe("audit chain integrity (real Postgres round-trip)", () => {
  it("verifies clean for entries carrying object and string details", async () => {
    await logAudit({
      tenantId,
      action: "consent.granted",
      entityType: "User",
      entityId: "user-1",
      details: { email: "a@b.dev", scopes: ["data-processing"] }, // object details
    })
    await logAudit({
      tenantId,
      action: "biomarker.created",
      entityType: "Biomarker",
      entityId: "bm-1",
      details: { name: "hsCRP", value: 0.8, unit: "mg/L" },
    })
    await logAudit({
      tenantId,
      action: "account.deleted",
      entityType: "User",
      entityId: "user-1",
      details: '{"already":"stringified"}', // string details
    })

    const result = await verifyAuditChain(tenantId)

    expect(result.brokenLinks).toEqual([])
    expect(result.valid).toBe(true)
    expect(result.checkedEntries).toBe(3)
  })

  it("detects tampering when a persisted detail is altered", async () => {
    const entry = await logAudit({
      tenantId,
      action: "policy.updated",
      entityType: "Policy",
      entityId: "pol-1",
      details: { value: "original" },
    })

    // Tamper: mutate the stored details without recomputing the hash.
    await db.auditLog.update({
      where: { id: entry!.id },
      data: { details: '{"value":"tampered"}' },
    })

    const result = await verifyAuditChain(tenantId)
    expect(result.valid).toBe(false)
    expect(result.brokenLinks.some((b) => b.id === entry!.id)).toBe(true)
  })
})
