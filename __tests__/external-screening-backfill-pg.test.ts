import { afterEach, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import { backfillEncryptScreeningSecrets } from "@/lib/external-screening-backfill"
import { encryptExternalSecret, isEncryptedExternalSecret } from "@/lib/external-secret-crypto"

const USER_ID = "screening-backfill-user"
const TENANT = "screening-backfill"

async function makeAdapter(secret: string) {
  return db.externalScreeningAdapter.create({
    data: {
      userId: USER_ID,
      tenantId: TENANT,
      name: `adapter-${secret.slice(0, 6)}`,
      endpointUrl: "https://screen.example.com/api",
      secret,
    },
    select: { id: true },
  })
}

describe("backfillEncryptScreeningSecrets (P0-SEC-002)", () => {
  afterEach(async () => {
    await db.externalScreeningAdapter.deleteMany({ where: { tenantId: TENANT } })
    await db.user.deleteMany({ where: { id: USER_ID } })
  })

  it("encrypts plaintext secrets and leaves already-encrypted ones untouched", async () => {
    await db.user.create({
      data: { id: USER_ID, email: `${USER_ID}@example.com`, passwordHash: "x", name: USER_ID },
    })

    const plain = await makeAdapter("legacy-plaintext-token")
    const alreadyEnc = await makeAdapter(encryptExternalSecret("already-encrypted-token"))

    const result = await backfillEncryptScreeningSecrets()

    // Only our two rows are asserted individually (the run may cover others).
    expect(result.encrypted).toBeGreaterThanOrEqual(1)

    const migrated = await db.externalScreeningAdapter.findUniqueOrThrow({ where: { id: plain.id } })
    expect(isEncryptedExternalSecret(migrated.secret)).toBe(true)
    expect(migrated.secret).not.toContain("legacy-plaintext-token")

    const untouched = await db.externalScreeningAdapter.findUniqueOrThrow({ where: { id: alreadyEnc.id } })
    // Re-running must not double-encrypt.
    const before = untouched.secret
    const second = await backfillEncryptScreeningSecrets()
    const after = await db.externalScreeningAdapter.findUniqueOrThrow({ where: { id: alreadyEnc.id } })
    expect(after.secret).toBe(before)
    expect(second.encrypted).toBe(0)
  })
})
