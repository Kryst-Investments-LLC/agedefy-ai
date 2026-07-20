import { afterAll, describe, expect, it } from "vitest"

import { grantGdprConsents, hasGdprConsent, requireGdprConsent } from "@/lib/consent"
import { db } from "@/lib/db"

const userIds: string[] = []

async function makeUser(label: string): Promise<string> {
  const id = `consent-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await db.user.create({
    data: { id, email: `${id}@example.com`, passwordHash: "x", name: "Consent Test" },
  })
  userIds.push(id)
  return id
}

afterAll(async () => {
  await db.userConsentGrant.deleteMany({ where: { userId: { in: userIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
})

describe("GDPR consent flow (real Postgres)", () => {
  it("blocks PHI access without consent, then allows after a grant", async () => {
    const userId = await makeUser("gate")

    expect(await hasGdprConsent(userId, "data-processing")).toBe(false)
    const blocked = await requireGdprConsent(userId, ["data-processing"])
    expect(blocked).not.toBeNull()
    expect(blocked!.status).toBe(403)

    await grantGdprConsents(userId, ["data-processing"], { legalBasis: "explicit-consent" })

    expect(await hasGdprConsent(userId, "data-processing")).toBe(true)
    expect(await requireGdprConsent(userId, ["data-processing"])).toBeNull()
  })

  it("records consent atomically inside a transaction (the onboarding path)", async () => {
    const userId = await makeUser("tx")

    await db.$transaction(async (tx) => {
      await grantGdprConsents(userId, ["data-processing", "ai-health-info"], {
        client: tx,
        policyVersion: "1.0",
      })
    })

    expect(await hasGdprConsent(userId, "data-processing")).toBe(true)
    expect(await hasGdprConsent(userId, "ai-health-info")).toBe(true)
    const grant = await db.userConsentGrant.findUnique({ where: { userId } })
    expect(grant?.status).toBe("active")
    expect(grant?.policyVersion).toBe("1.0")
  })

  it("grants only the requested categories", async () => {
    const userId = await makeUser("partial")

    await grantGdprConsents(userId, ["data-processing"])

    expect(await hasGdprConsent(userId, "data-processing")).toBe(true)
    expect(await hasGdprConsent(userId, "ai-health-info")).toBe(false)
  })

  it("is idempotent and preserves the original grantedAt on re-grant (backfill safety)", async () => {
    const userId = await makeUser("idem")

    const first = await grantGdprConsents(userId, ["data-processing"])
    const firstEntries = first.gdprConsents as Array<{ category: string; grantedAt?: string }>
    const firstGrantedAt = firstEntries.find((e) => e.category === "data-processing")?.grantedAt

    const second = await grantGdprConsents(userId, ["data-processing"])
    const secondEntries = second.gdprConsents as Array<{ category: string; grantedAt?: string }>
    const secondGrantedAt = secondEntries.find((e) => e.category === "data-processing")?.grantedAt

    expect(secondGrantedAt).toBe(firstGrantedAt) // original timestamp preserved
    expect(second.consentVersion).toBeGreaterThan(first.consentVersion) // version bumped
  })
})
