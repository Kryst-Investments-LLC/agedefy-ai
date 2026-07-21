import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { requireGdprConsent } from "@/lib/consent"
import { db } from "@/lib/db"
import { buildApiCanonicalEventContext } from "@/lib/events/api-context"
import { biomarkerRecordToEvent } from "@/lib/events/ingestion"
import { PrismaTransactionalHealthEventIngestionService } from "@/lib/events/transactional-ingestion-service"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { triggerLoopCycle } from "@/lib/loop/loop-trigger"
import { logger } from "@/lib/logger"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { biomarkerSchema } from "@/lib/validators/workspace"
import { withHttpMetrics } from "@/lib/observability/with-http-metrics"

export const POST = withHttpMetrics("/api/biomarkers", biomarkersPostHandler)

async function biomarkersPostHandler(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Health-data processing requires an active consent grant (captured at
  // onboarding). Returns 403 CONSENT_REQUIRED if the user has not consented.
  const consentBlocked = await requireGdprConsent(session.user.id, ["data-processing"])
  if (consentBlocked) return consentBlocked

  const payload = await request.json()
  const parsedPayload = biomarkerSchema.safeParse(payload)

  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid biomarker payload", details: parsedPayload.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, ...parsedPayload.data }),
    execute: async () => {
      const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
      const eventContext = buildApiCanonicalEventContext(session, request)

      const { result: biomarker } = await ingestionService.ingestMutation(async (tx) => {
        const biomarker = await tx.biomarker.create({
          data: {
            userId: session.user.id,
            name: parsedPayload.data.name,
            value: parsedPayload.data.value,
            unit: parsedPayload.data.unit,
            target: parsedPayload.data.target,
            trend: parsedPayload.data.trend,
            measuredAt: parsedPayload.data.measuredAt ? new Date(parsedPayload.data.measuredAt) : new Date(),
            protocolId: parsedPayload.data.protocolId ?? undefined,
          },
        })

        return {
          result: biomarker,
          event: biomarkerRecordToEvent(biomarker, eventContext),
        }
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        action: "biomarker.created",
        entityType: "Biomarker",
        entityId: biomarker.id,
        details: { name: biomarker.name, value: biomarker.value, unit: biomarker.unit },
      })

      void triggerLoopCycle({
        userId: session.user.id,
        tenantId: tenantContext.tenantId,
        reason: "BIOMARKER_INGEST",
      }).catch((err) => logger.warn("Loop trigger failed after biomarker ingest", { error: String(err) }))

      return { status: 201, body: biomarker }
    },
  })
}