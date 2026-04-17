import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildApiCanonicalEventContext } from '@/lib/events/api-context'
import { adverseEventRecordToEvent } from '@/lib/events/ingestion'
import { PrismaTransactionalHealthEventIngestionService } from '@/lib/events/transactional-ingestion-service'
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from '@/lib/idempotency'
import { applyRateLimit } from '@/lib/rate-limit'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import { adverseEventMutationSchema, adverseEventUpdateSchema } from '@/lib/validators/safety'

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)
  const parsedPayload = adverseEventMutationSchema.safeParse(payload)

  if (!parsedPayload.success) {
    return NextResponse.json({ error: parsedPayload.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })
  const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
  const eventContext = buildApiCanonicalEventContext(session, request)

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, payload: parsedPayload.data, action: 'create' }),
    execute: async () => {
      const { result: adverseEvent } = await ingestionService.ingestMutation(async (tx) => {
        const adverseEvent = await tx.adverseEventReport.create({
      data: {
        userId: session.user.id,
        protocolId: parsedPayload.data.protocolId,
        severity: parsedPayload.data.severity,
        seriousness: parsedPayload.data.seriousness,
        category: parsedPayload.data.category,
        suspectedCause: parsedPayload.data.suspectedCause,
        symptoms: toInputJson(parsedPayload.data.symptoms),
        detectedBy: parsedPayload.data.detectedBy,
        onsetAt: parsedPayload.data.onsetAt ? new Date(parsedPayload.data.onsetAt) : null,
        resolvedAt: parsedPayload.data.resolvedAt ? new Date(parsedPayload.data.resolvedAt) : null,
        outcome: parsedPayload.data.outcome,
        escalationRequired: parsedPayload.data.escalationRequired,
        regulatorReportable: parsedPayload.data.regulatorReportable,
        note: parsedPayload.data.note,
      },
    })

        return {
          result: adverseEvent,
          event: adverseEventRecordToEvent(adverseEvent, eventContext),
        }
      })

      return { status: 201, body: adverseEvent }
    },
  })
}

export async function PATCH(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)
  const parsedPayload = adverseEventUpdateSchema.safeParse(payload)

  if (!parsedPayload.success) {
    return NextResponse.json({ error: parsedPayload.error.flatten() }, { status: 400 })
  }

  const existing = await db.adverseEventReport.findFirst({
    where: {
      id: parsedPayload.data.id,
      userId: session.user.id,
    },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Adverse event not found' }, { status: 404 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })
  const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
  const eventContext = buildApiCanonicalEventContext(session, request)

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, payload: parsedPayload.data, action: 'update' }),
    execute: async () => {
      const { result: adverseEvent } = await ingestionService.ingestMutation(async (tx) => {
        const adverseEvent = await tx.adverseEventReport.update({
      where: { id: parsedPayload.data.id },
      data: {
        ...(parsedPayload.data.protocolId !== undefined ? { protocolId: parsedPayload.data.protocolId } : {}),
        ...(parsedPayload.data.severity !== undefined ? { severity: parsedPayload.data.severity } : {}),
        ...(parsedPayload.data.seriousness !== undefined ? { seriousness: parsedPayload.data.seriousness } : {}),
        ...(parsedPayload.data.category !== undefined ? { category: parsedPayload.data.category } : {}),
        ...(parsedPayload.data.suspectedCause !== undefined ? { suspectedCause: parsedPayload.data.suspectedCause } : {}),
        ...(parsedPayload.data.symptoms !== undefined ? { symptoms: toInputJson(parsedPayload.data.symptoms) } : {}),
        ...(parsedPayload.data.detectedBy !== undefined ? { detectedBy: parsedPayload.data.detectedBy } : {}),
        ...(parsedPayload.data.onsetAt !== undefined ? { onsetAt: parsedPayload.data.onsetAt ? new Date(parsedPayload.data.onsetAt) : null } : {}),
        ...(parsedPayload.data.resolvedAt !== undefined ? { resolvedAt: parsedPayload.data.resolvedAt ? new Date(parsedPayload.data.resolvedAt) : null } : {}),
        ...(parsedPayload.data.outcome !== undefined ? { outcome: parsedPayload.data.outcome } : {}),
        ...(parsedPayload.data.escalationRequired !== undefined ? { escalationRequired: parsedPayload.data.escalationRequired } : {}),
        ...(parsedPayload.data.regulatorReportable !== undefined ? { regulatorReportable: parsedPayload.data.regulatorReportable } : {}),
        ...(parsedPayload.data.note !== undefined ? { note: parsedPayload.data.note } : {}),
      },
    })

        return {
          result: adverseEvent,
          event: adverseEventRecordToEvent(adverseEvent, eventContext, {
            occurredAt: new Date(),
            status: 'corrected',
          }),
        }
      })

      return { status: 200, body: adverseEvent }
    },
  })
}