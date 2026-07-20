import { db } from "@/lib/db"

interface WebhookDeliveryRef {
  provider: string
  route: string
  eventId: string
}

/**
 * Claim a webhook delivery for processing.
 *
 * The record is created as PENDING — NOT completed. It is only marked COMPLETED
 * by completeWebhookDelivery() after the side effects have actually succeeded.
 * This closes the drop-on-failure bug: if processing throws, the record stays
 * PENDING, the handler returns a non-2xx, and the provider's retry re-selects
 * the delivery (claimed=true) so the side effects run to completion.
 *
 * Returns claimed=false ONLY when a prior delivery has already COMPLETED, so a
 * genuinely-processed event is never reprocessed. A PENDING record left by a
 * crashed prior attempt is reclaimable. (Handlers must remain idempotent — the
 * upsert-based Stripe handlers are — so a rare concurrent redelivery converges.)
 *
 * Backed by the IdempotencyRecord table under tenant `_webhook_<provider>_` so
 * webhook deliveries don't collide with per-user request idempotency.
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
        status: "PENDING",
        expiresAt,
      },
    })
    return { claimed: true }
  } catch (error) {
    // Unique constraint violation = a record already exists for this event.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      const existing = await db.idempotencyRecord.findUnique({
        where: {
          tenantId_route_method_key: {
            tenantId,
            route: options.route,
            method: "POST",
            key: options.eventId,
          },
        },
        select: { status: true },
      })
      // Already fully processed → do not reprocess.
      if (existing?.status === "COMPLETED") return { claimed: false }
      // A prior attempt crashed before completing → reclaim and reprocess.
      return { claimed: true }
    }
    throw error
  }
}

/**
 * Mark a claimed webhook delivery COMPLETED. Call ONLY after all side effects
 * have succeeded. Idempotent.
 */
export async function completeWebhookDelivery(options: WebhookDeliveryRef): Promise<void> {
  const tenantId = `_webhook_${options.provider}_`
  await db.idempotencyRecord.updateMany({
    where: { tenantId, route: options.route, method: "POST", key: options.eventId },
    data: { status: "COMPLETED", completedAt: new Date() },
  })
}

/**
 * Record a processing failure against a claimed webhook delivery (best-effort;
 * leaves the record PENDING so the provider's retry reprocesses it).
 */
export async function failWebhookDelivery(
  options: WebhookDeliveryRef & { errorMessage: string },
): Promise<void> {
  const tenantId = `_webhook_${options.provider}_`
  await db.idempotencyRecord
    .updateMany({
      where: { tenantId, route: options.route, method: "POST", key: options.eventId },
      data: { status: "PENDING", errorMessage: options.errorMessage.slice(0, 500) },
    })
    .catch(() => {})
}
