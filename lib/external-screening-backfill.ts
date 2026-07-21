import type { PrismaClient } from "@prisma/client"

import { db } from "@/lib/db"
import { encryptExternalSecret, isEncryptedExternalSecret } from "@/lib/external-secret-crypto"

type Client = Pick<PrismaClient, "externalScreeningAdapter">

export interface ScreeningSecretBackfillResult {
  total: number
  encrypted: number
  skipped: number
}

/**
 * One-time migration for P0-SEC-002: encrypt any ExternalScreeningAdapter.secret
 * still stored in plaintext (records written before encrypt-on-write existed).
 * Idempotent — rows already carrying an `enc:v1:` ciphertext are left untouched,
 * so it is safe to run repeatedly.
 */
export async function backfillEncryptScreeningSecrets(
  client: Client = db,
): Promise<ScreeningSecretBackfillResult> {
  const adapters = await client.externalScreeningAdapter.findMany({
    select: { id: true, secret: true },
  })

  let encrypted = 0
  let skipped = 0

  for (const adapter of adapters) {
    if (isEncryptedExternalSecret(adapter.secret)) {
      skipped += 1
      continue
    }
    await client.externalScreeningAdapter.update({
      where: { id: adapter.id },
      data: { secret: encryptExternalSecret(adapter.secret) },
    })
    encrypted += 1
  }

  return { total: adapters.length, encrypted, skipped }
}
