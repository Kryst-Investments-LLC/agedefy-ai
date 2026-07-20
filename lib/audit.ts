import { Prisma, ReviewSeverity, ReviewStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { computeEntryHash, getLatestHash } from "@/lib/audit-integrity"
import { logger } from "@/lib/logger"
import { getFallbackTenantId, resolveStoredTenantContextForUser } from "@/lib/tenancy"

type AuditLogInput = {
  actorUserId?: string
  actorEmail?: string
  tenantId?: string
  action: string
  entityType: string
  entityId?: string
  details?: Record<string, unknown> | string
}

type ReviewItemInput = {
  title: string
  category: string
  severity?: ReviewSeverity
  details?: string
  relatedEntityType?: string
  relatedEntityId?: string
}

const MAX_AUDIT_RETRIES = 3

async function writeAuditEntry(input: AuditLogInput) {
  const tenantId = input.tenantId ?? (input.actorUserId
    ? (await resolveStoredTenantContextForUser(input.actorUserId)).tenantId
    : getFallbackTenantId())

  const detailsStr = typeof input.details === "string" ? input.details : input.details ? JSON.stringify(input.details) : null

  // Serialize the read-then-write of the hash chain inside a transaction.
  // Retry on serialization conflicts so the chain stays consistent under
  // concurrent writers without holding a long-lived lock.
  for (let attempt = 1; attempt <= MAX_AUDIT_RETRIES; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const prevHash = await getLatestHash(tenantId, tx)
        const id = crypto.randomUUID()
        const entryHash = computeEntryHash({
          id,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          details: detailsStr,
          prevHash,
        })
        return tx.auditLog.create({
          data: {
            id,
            actorUserId: input.actorUserId,
            actorEmail: input.actorEmail,
            tenantId,
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId,
            details: detailsStr,
            prevHash,
            entryHash,
          },
        })
      })
    } catch (error) {
      if (attempt === MAX_AUDIT_RETRIES) throw error
    }
  }
  throw new Error("audit.write.unreachable")
}

/**
 * Write an audit entry through an existing transaction. Callers use this when
 * the audited mutation and its audit record must commit or roll back together.
 * A tenant must be supplied so tenant resolution cannot escape the transaction.
 */
export async function logAuditInTransactionOrThrow(
  tx: Prisma.TransactionClient,
  input: AuditLogInput & { tenantId: string },
) {
  const detailsStr = typeof input.details === "string"
    ? input.details
    : input.details
      ? JSON.stringify(input.details)
      : null
  const prevHash = await getLatestHash(input.tenantId, tx)
  const id = crypto.randomUUID()
  const entryHash = computeEntryHash({
    id,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    details: detailsStr,
    prevHash,
  })

  return tx.auditLog.create({
    data: {
      id,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      tenantId: input.tenantId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: detailsStr,
      prevHash,
      entryHash,
    },
  })
}

/**
 * Persist an audit entry. Errors are caught and logged so a transient DB
 * failure cannot fail the parent request — the audit chain is best-effort
 * for availability, with retries for integrity.
 *
 * Use `logAuditOrThrow` if you need the entry to be guaranteed durable
 * before the request completes (e.g. compliance flows).
 */
export async function logAudit(input: AuditLogInput) {
  try {
    return await writeAuditEntry(input)
  } catch (error) {
    logger.error("audit.write.failed", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      tenantId: input.tenantId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Strict variant — throws if the audit entry cannot be persisted. Use only
 * where audit durability is part of the user-visible contract.
 */
export async function logAuditOrThrow(input: AuditLogInput) {
  return writeAuditEntry(input)
}

export async function createReviewItem(input: ReviewItemInput) {
  return db.reviewItem.create({
    data: {
      title: input.title,
      category: input.category,
      severity: input.severity ?? ReviewSeverity.MEDIUM,
      details: input.details,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      status: ReviewStatus.OPEN,
    },
  })
}

export type { ReviewItemInput }
