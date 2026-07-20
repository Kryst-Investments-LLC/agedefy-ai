import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { db } from "@/lib/db"
import { buildApiCanonicalEventContext } from "@/lib/events/api-context"
import { consultationRecordToEvent } from "@/lib/events/ingestion"
import { PrismaTransactionalHealthEventIngestionService } from "@/lib/events/transactional-ingestion-service"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import { requireAuthWithRole } from "@/lib/rbac"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { consultationScheduleSchema } from "@/lib/validators/telemedicine"
import { requireRecentMfa } from "@/lib/security/recent-mfa"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, "CLINICIAN", "ADMIN")
  if (authResult instanceof NextResponse) return authResult
  const mfaRequired = await requireRecentMfa(authResult.user.id)
  if (mfaRequired) return mfaRequired

  const body = await request.json().catch(() => null)
  const parsed = consultationScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id } = await context.params
  const consultation = await db.consultationRequest.findUnique({ where: { id } })
  if (!consultation) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 })
  }

  if (consultation.status !== "REQUESTED") {
    return NextResponse.json({ error: `Cannot transition consultation from ${consultation.status} to SCHEDULED` }, { status: 409 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: authResult.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })
  const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
  const eventContext = buildApiCanonicalEventContext(authResult, request)

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: authResult.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: authResult.user.id, consultationId: id, payload: parsed.data, action: "schedule" }),
    execute: async () => {
      const { result: updated } = await ingestionService.ingestMutation(async (tx) => {
        const updated = await tx.consultationRequest.update({
          where: { id },
          data: {
            status: "SCHEDULED",
            scheduledAt: new Date(parsed.data.scheduledAt),
            ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}),
          },
          include: { provider: true },
        })

        return {
          result: updated,
          event: consultationRecordToEvent(updated, eventContext),
        }
      })

      await logAudit({
        actorUserId: authResult.user.id,
        actorEmail: authResult.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "consultation.scheduled",
        entityType: "ConsultationRequest",
        entityId: id,
      })

      logger.info("Consultation scheduled", { consultationId: id, actor: authResult.user.id })

      return { status: 200, body: updated }
    },
  })
}
