import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { summarizeOutcomeDelta } from "@/lib/biomedical-intelligence"
import { db } from "@/lib/db"
import { buildApiCanonicalEventContext } from "@/lib/events/api-context"
import { outcomeRecordToEvent } from "@/lib/events/ingestion"
import { PrismaTransactionalHealthEventIngestionService } from "@/lib/events/transactional-ingestion-service"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { interventionOutcomeSchema } from "@/lib/validators/intelligence"

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const outcomes = await db.interventionOutcome.findMany({
    where: { userId: session.user.id },
    include: { protocol: { select: { id: true, name: true, status: true } } },
    orderBy: { observedAt: "desc" },
    take: 100,
  })

  return NextResponse.json({ outcomes })
}

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 15, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = interventionOutcomeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, ...parsed.data }),
    execute: async () => {
      const outcomeDelta = summarizeOutcomeDelta(parsed.data.baselineValue, parsed.data.latestValue)
      const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
      const eventContext = buildApiCanonicalEventContext(session, request)

      const { result: outcome } = await ingestionService.ingestMutation(async (tx) => {
        const outcome = await tx.interventionOutcome.create({
          data: {
            userId: session.user.id,
            protocolId: parsed.data.protocolId,
            biomarkerName: parsed.data.biomarkerName,
            baselineValue: parsed.data.baselineValue,
            latestValue: parsed.data.latestValue,
            delta: outcomeDelta.delta,
            confidenceScore: parsed.data.confidenceScore ?? 0.5,
            observedAt: parsed.data.observedAt ? new Date(parsed.data.observedAt) : new Date(),
            notes: parsed.data.notes,
          },
          include: { protocol: { select: { id: true, name: true, status: true } } },
        })

        return {
          result: outcome,
          event: outcomeRecordToEvent(outcome, eventContext),
        }
      })

      return { status: 201, body: { outcome, direction: outcomeDelta.direction } }
    },
  })
}