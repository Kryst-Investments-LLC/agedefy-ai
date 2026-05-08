import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { buildApiCanonicalEventContext } from "@/lib/events/api-context"
import { consultationRecordToEvent } from "@/lib/events/ingestion"
import { PrismaTransactionalHealthEventIngestionService } from "@/lib/events/transactional-ingestion-service"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { consultationCancelSchema } from "@/lib/validators/telemedicine"

// GET: List user's consultation requests
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const consultations = await db.consultationRequest.findMany({
    where: { userId: session.user.id },
    include: { provider: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return NextResponse.json(consultations)
}

// PATCH: Cancel a consultation request
export async function PATCH(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = consultationCancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const consultationId = parsed.data.id

  const consultation = await db.consultationRequest.findUnique({
    where: { id: consultationId },
  })

  if (!consultation) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 })
  }

  if (consultation.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const cancelable = ["REQUESTED", "SCHEDULED"]
  if (!cancelable.includes(consultation.status)) {
    return NextResponse.json(
      { error: "Only REQUESTED or SCHEDULED consultations can be canceled" },
      { status: 409 }
    )
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })
  const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
  const eventContext = buildApiCanonicalEventContext(session, request)

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, consultationId, action: "cancel" }),
    execute: async () => {
      const { result: updated } = await ingestionService.ingestMutation(async (tx) => {
        const updated = await tx.consultationRequest.update({
          where: { id: consultationId },
          data: {
            status: "CANCELED",
          },
          include: { provider: true },
        })

        return {
          result: updated,
          event: consultationRecordToEvent(updated, eventContext),
        }
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "consultation.canceled",
        entityType: "ConsultationRequest",
        entityId: consultationId,
      })

      logger.info("Consultation canceled", { consultationId, actor: session.user.id })

      return { status: 200, body: updated }
    },
  })
}
