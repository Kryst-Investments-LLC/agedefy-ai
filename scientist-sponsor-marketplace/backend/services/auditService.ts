import { logAudit } from "@/lib/audit"
import { logger } from "@/lib/logger"
import { BaseCrudService } from "@/scientist-sponsor-marketplace/backend/services/baseCrudService"

export const auditService = new BaseCrudService<Record<string, unknown>, Record<string, unknown>>({
  modelName: "marketplaceAuditLog",
  defaultOrderBy: { createdAt: "desc" },
})

export async function logMarketplaceAuditEvent(input: Record<string, unknown>) {
  const created = await auditService.create(input)

  try {
    await logAudit({
      actorUserId: typeof input.actorUserId === "string" ? input.actorUserId : undefined,
      action: typeof input.action === "string" ? input.action : "marketplace.event",
      entityType: `marketplace.${typeof input.entityType === "string" ? input.entityType : "entity"}`,
      entityId: typeof input.entityId === "string" ? input.entityId : undefined,
      details: typeof input.details === "string" || typeof input.details === "object" ? (input.details as Record<string, unknown> | string) : undefined,
    })
  } catch (error) {
    logger.warn("Marketplace audit mirror into platform audit log failed", {
      action: input.action,
      entityType: input.entityType,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return created
}
