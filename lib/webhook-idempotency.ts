import { db } from "@/lib/db"

/**
 * Returns true if this webhook event was just claimed (first time seen),
 * false if a prior delivery has already been processed.
 *
 * Backed by the existing IdempotencyRecord table — webhook deliveries
 * are stored under tenant `_webhook_<provider>_` so they don't collide
 * with per-user request idempotency.
 */
export async function claimWebhookDelivery(options: {
  provider: string
  route: string
  eventId: string
  ttlMs?: number
}): Promise<{ claimed: boolean }> {
  const tenantId = `_webhook_${options.provider}_`
  const ttlMs = options.ttlMs ?? 1000 * 60 * 60 * 24 * 30 // 30 days
  const expiresAt = new Date(Date.now() + ttlMs)

  try {
    await db.idempotencyRecord.create({
      data: {
        tenantId,
        route: options.route,
        method: "POST",
        key: options.eventId,
        requestFingerprint: options.eventId,
        status: "COMPLETED",
        completedAt: new Date(),
        expiresAt,
      },
    })
    return { claimed: true }
  } catch (error) {
    // Unique constraint violation = already processed
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { claimed: false }
    }
    throw error
  }
}
