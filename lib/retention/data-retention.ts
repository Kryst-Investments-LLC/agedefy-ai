import { db } from "@/lib/db"

export interface TransientPurgeResult {
  idempotencyRecordsDeleted: number
  verificationTokensDeleted: number
}

/**
 * Purge transient records whose OWN expiry has already passed. This is retention
 * with zero policy judgement: each record carries an explicit expiry
 * (IdempotencyRecord.expiresAt, VerificationToken.expires), so deleting rows
 * past that instant is always safe.
 *
 * Health-data / PHI retention windows are a separate governance + legal decision
 * (how long to keep biomarkers, agent sessions, etc.) and are deliberately NOT
 * purged here — that requires a documented retention policy, not a default.
 */
export async function purgeExpiredTransientData(now: Date = new Date()): Promise<TransientPurgeResult> {
  const idempotency = await db.idempotencyRecord.deleteMany({
    where: { expiresAt: { not: null, lt: now } },
  })
  const tokens = await db.verificationToken.deleteMany({
    where: { expires: { lt: now } },
  })

  return {
    idempotencyRecordsDeleted: idempotency.count,
    verificationTokensDeleted: tokens.count,
  }
}
