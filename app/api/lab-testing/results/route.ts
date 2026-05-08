import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildApiCanonicalEventContext } from '@/lib/events/api-context'
import { labOrderRecordToEvent } from '@/lib/events/ingestion'
import { PrismaTransactionalHealthEventIngestionService } from '@/lib/events/transactional-ingestion-service'
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from '@/lib/idempotency'
import { applyRateLimit } from '@/lib/rate-limit'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import { labResultMutationSchema } from '@/lib/validators/lab-testing'

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)
  const parsedPayload = labResultMutationSchema.safeParse(payload)

  if (!parsedPayload.success) {
    return NextResponse.json({ error: parsedPayload.error.flatten() }, { status: 400 })
  }

  const order = await db.labOrder.findFirst({
    where: {
      id: parsedPayload.data.orderId,
      userId: session.user.id,
    },
    include: {
      panel: true,
      results: true,
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Lab order not found' }, { status: 404 })
  }

  const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
  const eventContext = buildApiCanonicalEventContext(session, request)
  const completedAt = parsedPayload.data.completedAt ? new Date(parsedPayload.data.completedAt) : new Date()
  const nextLabStatus = order.results.length > 0 ? 'corrected' : 'resulted'
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, payload: parsedPayload.data }),
    execute: async () => {
      const { result: updatedOrder } = await ingestionService.ingestMutation(async (tx) => {
        await tx.labResult.createMany({
      data: parsedPayload.data.results.map((result) => ({
        orderId: order.id,
        biomarkerName: result.biomarkerName,
        value: result.value,
        unit: result.unit,
        refLow: result.refLow,
        refHigh: result.refHigh,
        flag: result.flag,
        protocolId: result.protocolId,
      })),
    })

      const updatedOrder = await tx.labOrder.update({
      where: { id: order.id },
      data: {
        status: 'COMPLETED',
        completedAt,
      },
      include: {
        panel: true,
        results: true,
      },
    })

        return {
          result: updatedOrder,
          event: labOrderRecordToEvent(updatedOrder, eventContext, {
            occurredAt: completedAt,
            status: nextLabStatus === 'corrected' ? 'corrected' : undefined,
            labStatus: nextLabStatus,
          }),
        }
      })

      return { status: 201, body: updatedOrder }
    },
  })
}