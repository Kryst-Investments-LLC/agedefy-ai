import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { detectDrift } from '@/lib/agents/drift-detector'
import {
  claimWebhookDelivery,
  completeWebhookDelivery,
  failWebhookDelivery,
} from '@/lib/webhook-idempotency'
import { triggerLoopCycle } from '@/lib/loop/loop-trigger'
import { promoteWearableMetrics } from '@/lib/wearables/biomarker-bridge'
import { verifyWebhookSignature } from '@/lib/wearables/terra-client'
import { normalizeTerraPayload } from '@/lib/wearables/normalizer'

/**
 * POST /api/wearables/webhook
 *
 * Receives Terra webhook events, validates them, normalises the data, and
 * stores it as PartnerDataRecords with source=WEARABLE.
 *
 * Terra sends: auth events, body, activity, sleep, daily, nutrition data.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Verify webhook signature — reject if missing or invalid (fail-closed)
  const signature = request.headers.get('terra-signature')
  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    logger.warn('Terra webhook signature verification failed', { hasSignature: !!signature })
    return NextResponse.json({ error: 'Invalid or missing signature' }, { status: 401 })
  }

  // Idempotency guard — Terra retries deliveries; reject duplicates.
  // Terra does not send a stable event id, so we hash the signed body.
  const deliveryId = createHash('sha256').update(rawBody).digest('hex')
  const deliveryRef = {
    provider: 'terra' as const,
    route: '/api/wearables/webhook',
    eventId: deliveryId,
  }
  const claim = await claimWebhookDelivery(deliveryRef)
  if (!claim.claimed) {
    logger.info('Terra webhook duplicate delivery ignored', { deliveryId })
    return NextResponse.json({ ok: true, duplicate: true })
  }

  // The delivery is claimed PENDING. It is only marked COMPLETED after the side
  // effects for this event succeed; on failure it stays PENDING so Terra's retry
  // reprocesses it (rather than the side effects being dropped, or — with the
  // claim-PENDING model — a retry duplicating already-ingested health records).
  try {
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody)
    } catch {
      // Deterministically malformed body — mark handled so it is not retried.
      await completeWebhookDelivery(deliveryRef)
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const eventType = payload.type as string | undefined
    const user = payload.user as { user_id?: string; reference_id?: string; provider?: string } | undefined

    // Handle user auth events (connection/deauth)
    if (eventType === 'auth') {
      const referenceId = user?.reference_id
      const terraUserId = user?.user_id
      const provider = (user?.provider ?? 'unknown').toLowerCase()

      if (referenceId && terraUserId) {
        await db.wearableConnection.upsert({
          where: { userId_provider: { userId: referenceId, provider } },
          update: {
            externalUserId: terraUserId,
            status: 'active',
            connectedAt: new Date(),
          },
          create: {
            userId: referenceId,
            provider,
            externalUserId: terraUserId,
            status: 'active',
          },
        })
        logger.info('Wearable connected via Terra', { userId: referenceId, provider })
      }
      await completeWebhookDelivery(deliveryRef)
      return NextResponse.json({ ok: true })
    }

    if (eventType === 'deauth') {
      const referenceId = user?.reference_id
      const provider = (user?.provider ?? 'unknown').toLowerCase()
      if (referenceId) {
        await db.wearableConnection.updateMany({
          where: { userId: referenceId, provider },
          data: { status: 'disconnected' },
        })
        logger.info('Wearable disconnected via Terra', { userId: referenceId, provider })
      }
      await completeWebhookDelivery(deliveryRef)
      return NextResponse.json({ ok: true })
    }

    // Data events: body, activity, sleep, daily, nutrition
    const referenceId = user?.reference_id
    if (!referenceId) {
      logger.warn('Terra webhook missing reference_id', { type: eventType })
      await completeWebhookDelivery(deliveryRef)
      return NextResponse.json({ ok: true }) // Acknowledge but skip
    }

    // Normalize and store
    const normalized = normalizeTerraPayload(payload as unknown as Parameters<typeof normalizeTerraPayload>[0])

    for (const event of normalized) {
      await db.partnerDataRecord.create({
        data: {
          userId: referenceId,
          source: 'WEARABLE',
          partnerId: `terra:${user?.provider?.toLowerCase() ?? 'unknown'}`,
          label: `${event.deviceManufacturer ?? 'Wearable'} ${event.activityContext ?? 'data'}`,
          payload: JSON.stringify(event),
        },
      })
    }

    // Update last sync timestamp
    const provider = (user?.provider ?? 'unknown').toLowerCase()
    await db.wearableConnection.updateMany({
      where: { userId: referenceId, provider },
      data: { lastSyncAt: new Date() },
    })

    // Promote eligible wearable metrics to biomarker records
    const allMetrics = normalized.flatMap((e) => e.metrics)
    const promotion = await promoteWearableMetrics(referenceId, allMetrics, provider)

    // Trigger self-improving loop when new biomarkers arrive from wearable
    if (promotion.promoted > 0) {
      void triggerLoopCycle({
        userId: referenceId,
        tenantId: "default",
        reason: "WEARABLE_SYNC",
      }).catch((err) => logger.warn("Loop trigger failed after wearable sync", { error: String(err) }))
    }

    // Run drift detection when new biomarkers were promoted
    let driftFindings = 0
    if (promotion.promoted > 0) {
      try {
        const drift = await detectDrift(referenceId)
        driftFindings = drift.findings.length
        if (driftFindings > 0) {
          logger.info('Drift detected after wearable sync', {
            userId: referenceId,
            findings: driftFindings,
          })
        }
      } catch (err) {
        logger.error('Drift detection failed after wearable sync', { err })
      }
    }

    logger.info('Terra wearable data ingested', {
      userId: referenceId,
      type: eventType,
      eventCount: normalized.length,
      promoted: promotion.promoted,
      driftFindings,
    })

    await completeWebhookDelivery(deliveryRef)
    return NextResponse.json({
      ok: true,
      ingested: normalized.length,
      promoted: promotion.promoted,
    })
  } catch (err) {
    // Leave the delivery PENDING so Terra's retry reprocesses it, and signal
    // non-2xx so Terra knows to retry.
    const message = err instanceof Error ? err.message : String(err)
    await failWebhookDelivery({ ...deliveryRef, errorMessage: message })
    logger.error('Terra webhook processing failed', { deliveryId, error: message })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
