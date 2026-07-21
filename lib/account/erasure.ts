import { db } from "@/lib/db"

type ErasureClient = {
  idempotencyRecord: { deleteMany: (typeof db.idempotencyRecord)["deleteMany"] }
  auditLog: { updateMany: (typeof db.auditLog)["updateMany"] }
}

/**
 * Erase residual PII that a plain cascade delete of the User row leaves behind
 * (GDPR Art. 17 right to erasure). Call BEFORE deleting the user, while
 * `actorUserId` still points at them.
 *
 * - IdempotencyRecord has no FK to User, so cached response bodies (which can
 *   contain PHI) survive a cascade — delete the user's records outright.
 * - AuditLog.actorEmail is stripped. actorEmail is NOT part of the tamper-
 *   evident entry hash (id/action/entityType/entityId/details/prevHash), so the
 *   hash chain stays valid. Hashed `details` (e.g. historic biomarker values)
 *   are retained under the legal-obligation basis for an audit trail
 *   (GDPR Art. 17(3)(b)); they cannot be rewritten without breaking the chain.
 */
export async function eraseUserResidualPii(
  userId: string,
  client: ErasureClient = db,
): Promise<void> {
  await client.idempotencyRecord.deleteMany({ where: { actorUserId: userId } })
  await client.auditLog.updateMany({
    where: { actorUserId: userId },
    data: { actorEmail: null },
  })
}
