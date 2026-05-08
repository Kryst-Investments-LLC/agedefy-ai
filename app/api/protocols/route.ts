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
import { protocolSchema } from "@/lib/validators/workspace"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await request.json()
  const parsedPayload = protocolSchema.safeParse(payload)

  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid protocol payload", details: parsedPayload.error.flatten() }, { status: 400 })
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

      const { result: protocol } = await ingestionService.ingestMutation(async (tx) => {
        const protocol = await tx.protocol.create({
          data: {
            userId: session.user.id,
            name: parsedPayload.data.name,
            description: parsedPayload.data.description,
            status: parsedPayload.data.status,
            contraindicationScore: parsedPayload.data.contraindicationScore ?? undefined,
          },
        })

        return {
          result: protocol,
          event: protocolRecordToEvent(protocol, eventContext),
        }
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        action: "protocol.created",
        entityType: "Protocol",
        entityId: protocol.id,
        details: { name: protocol.name, status: protocol.status },
      })

      return { status: 201, body: protocol }
    },
  })
}