import { db } from "@/lib/db"
import { enqueueOrchestrationJob } from "@/lib/jobs/queue"
import { logger } from "@/lib/logger"
import { BaseCrudService } from "@/scientist-sponsor-marketplace/backend/services/baseCrudService"

export const notificationService = new BaseCrudService<Record<string, unknown>, Record<string, unknown>>({
  modelName: "marketplaceNotification",
  defaultOrderBy: { createdAt: "desc" },
})

export async function notifyMarketplaceUser(input: Record<string, unknown>) {
  const created = await notificationService.create(input)
  const channels = Array.isArray(input.channels) ? input.channels.filter((value): value is string => typeof value === "string") : ["in-app"]

  try {
    await enqueueOrchestrationJob({
      tenantId: typeof input.tenantId === "string" && input.tenantId.length > 0 ? input.tenantId : "default",
      organizationId: typeof input.organizationId === "string" ? input.organizationId : undefined,
      queue: "NOTIFICATION",
      jobType: "notification.marketplace.dispatch",
      createdByUserId: typeof input.actorUserId === "string" ? input.actorUserId : undefined,
      dedupeKey: `marketplace-notification:${String((created as { id?: string }).id)}`,
      payload: {
        notificationId: String((created as { id?: string }).id),
        recipientUserId: typeof input.recipientUserId === "string" ? input.recipientUserId : null,
        type: typeof input.type === "string" ? input.type : null,
        title: typeof input.title === "string" ? input.title : "Marketplace notification",
        body: typeof input.body === "string" ? input.body : "A marketplace event needs your attention.",
        actionUrl: typeof input.actionUrl === "string" ? input.actionUrl : null,
        channels,
      },
    })

    logger.info("Marketplace notification queued for durable delivery", {
      notificationId: String((created as { id?: string }).id),
      channels,
    })
  } catch (error) {
    logger.error("Marketplace notification queueing failed", {
      notificationId: String((created as { id?: string }).id),
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return created
}
