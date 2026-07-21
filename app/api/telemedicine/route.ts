import { BillingRecordStatus } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { resolveTelemedicineConsultationBilling } from "@/lib/billing"
import { db } from "@/lib/db"
import { buildApiCanonicalEventContext } from "@/lib/events/api-context"
import { consultationRecordToEvent } from "@/lib/events/ingestion"
import { PrismaTransactionalHealthEventIngestionService } from "@/lib/events/transactional-ingestion-service"
import { listPageHeaders, overfetchTake, parseListPageParams, splitOverfetch } from "@/lib/http/pagination"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { consultationRequestSchema } from "@/lib/validators/telemedicine"

// GET: List telehealth providers (paginated: ?limit=&offset=, X-Page-* headers)
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const { limit, offset } = parseListPageParams(searchParams, { defaultLimit: 100, maxLimit: 500 })
  const rows = await db.telehealthProvider.findMany({
    where: { acceptingNew: true },
    orderBy: { name: "asc" },
    skip: offset,
    take: overfetchTake(limit),
  })
  const { items, hasMore } = splitOverfetch(rows, limit)

  return NextResponse.json(items, { headers: listPageHeaders({ limit, offset, hasMore }) })
}

// POST: Request a consultation
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = consultationRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const reason = parsed.data.reason
  const type = parsed.data.type
  const providerId = parsed.data.providerId ?? null
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  if (providerId) {
    const provider = await db.telehealthProvider.findUnique({ where: { id: providerId } })
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }
  }

  const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
  const eventContext = buildApiCanonicalEventContext(session, request)

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, payload: parsed.data }),
    execute: async () => {
      const { result: consultation } = await ingestionService.ingestMutation(async (tx) => {
        const consultation = await tx.consultationRequest.create({
          data: {
            userId: session.user.id,
            providerId,
            type: type as "INITIAL" | "FOLLOW_UP" | "LAB_REVIEW" | "PROTOCOL_REVIEW",
            reason: reason.substring(0, 1000),
            notes: parsed.data.notes ? parsed.data.notes.substring(0, 500) : null,
          },
          include: { provider: true },
        })

        const billingRecord = resolveTelemedicineConsultationBilling(consultation.type)

        await tx.billingRecord.create({
          data: {
            tenantId: tenantContext.tenantId,
            userId: session.user.id,
            category: billingRecord.category,
            status: BillingRecordStatus.PENDING,
            description: billingRecord.description,
            amountCents: billingRecord.amountCents,
            currency: billingRecord.currency,
            pricingModel: billingRecord.pricingModel,
            consultationRequestId: consultation.id,
            metadata: {
              ...billingRecord.metadata,
              providerId,
            },
          },
        })

        return {
          result: consultation,
          event: consultationRecordToEvent(consultation, eventContext),
        }
      })

      return { status: 201, body: consultation }
    },
  })
}
