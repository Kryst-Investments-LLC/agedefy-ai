import { ReviewSeverity, ReviewStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { computeEntryHash, getLatestHash } from "@/lib/audit-integrity"
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

export async function logAudit(input: AuditLogInput) {
  const tenantId = input.tenantId ?? (input.actorUserId
    ? (await resolveStoredTenantContextForUser(input.actorUserId)).tenantId
    : getFallbackTenantId())

  const prevHash = await getLatestHash(tenantId)
  const detailsStr = typeof input.details === "string" ? input.details : input.details ? JSON.stringify(input.details) : null

  // Pre-generate a stable ID so we can compute the hash before inserting
  const id = crypto.randomUUID()

  const entryHash = computeEntryHash({
    id,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    details: detailsStr,
    prevHash,
  })

  return db.auditLog.create({
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