import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { buildApiCanonicalEventContext } from "@/lib/events/api-context"
import { biomarkerRecordToEvent } from "@/lib/events/ingestion"
import { PrismaTransactionalHealthEventIngestionService } from "@/lib/events/transactional-ingestion-service"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { requireRecentMfa } from "@/lib/security/recent-mfa"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const mfaRequired = await requireRecentMfa(session.user.id)
  if (mfaRequired) return mfaRequired

  const { id } = await context.params
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, id, action: "delete" }),
    execute: async () => {
      const biomarker = await db.biomarker.findFirst({
        where: { id, userId: session.user.id },
      })

      if (!biomarker) {
        return { status: 404, body: { error: "Biomarker not found" } }
      }

      const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
      const eventContext = buildApiCanonicalEventContext(session, request)

      await ingestionService.ingestMutation(async (tx) => {
        await tx.biomarker.delete({ where: { id } })

        return {
          result: { success: true },
          event: biomarkerRecordToEvent(biomarker, eventContext, {
            occurredAt: new Date(),
            status: 'deleted',
          }),
        }
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        action: "biomarker.deleted",
        entityType: "Biomarker",
        entityId: id,
        details: { name: biomarker.name },
      })

      return { status: 200, body: { success: true } }
    },
  })
}
