import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { buildApiCanonicalEventContext } from "@/lib/events/api-context"
import { protocolRecordToEvent } from "@/lib/events/ingestion"
import { PrismaTransactionalHealthEventIngestionService } from "@/lib/events/transactional-ingestion-service"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, id, action: "delete" }),
    execute: async () => {
      const protocol = await db.protocol.findFirst({
        where: { id, userId: session.user.id },
      })

      if (!protocol) {
        return { status: 404, body: { error: "Protocol not found" } }
      }

      const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
      const eventContext = buildApiCanonicalEventContext(session, request)

      await ingestionService.ingestMutation(async (tx) => {
        await tx.protocol.delete({ where: { id } })

        return {
          result: { success: true },
          event: protocolRecordToEvent(protocol, eventContext, 'cancelled', {
            occurredAt: new Date(),
            status: 'deleted',
          }),
        }
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        action: "protocol.deleted",
        entityType: "Protocol",
        entityId: id,
        details: { name: protocol.name },
      })

      return { status: 200, body: { success: true } }
    },
  })
}