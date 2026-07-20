import { BillingRecordStatus } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { resolveLabOrderBilling } from "@/lib/billing"
import { db } from "@/lib/db"
import { buildApiCanonicalEventContext } from "@/lib/events/api-context"
import { labOrderRecordToEvent } from "@/lib/events/ingestion"
import { PrismaTransactionalHealthEventIngestionService } from "@/lib/events/transactional-ingestion-service"
import { listPageHeaders, overfetchTake, parseListPageParams, splitOverfetch } from "@/lib/http/pagination"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

// GET: List available lab test panels (paginated: ?limit=&offset=, X-Page-* headers)
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const { limit, offset } = parseListPageParams(searchParams, { defaultLimit: 100, maxLimit: 500 })
  const rows = await db.labTestPanel.findMany({
    where: { status: "AVAILABLE" },
    orderBy: { category: "asc" },
    skip: offset,
    take: overfetchTake(limit),
  })
  const { items, hasMore } = splitOverfetch(rows, limit)

  return NextResponse.json(items, { headers: listPageHeaders({ limit, offset, hasMore }) })
}

// POST: Place a lab order
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const panelId = typeof body.panelId === "string" ? body.panelId : null

  if (!panelId) {
    return NextResponse.json({ error: "panelId is required" }, { status: 400 })
  }

  const panel = await db.labTestPanel.findUnique({ where: { id: panelId } })
  if (!panel || panel.status !== "AVAILABLE") {
    return NextResponse.json({ error: "Panel not available" }, { status: 404 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })
  const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
  const eventContext = buildApiCanonicalEventContext(session, request)

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, panelId, notes: typeof body.notes === "string" ? body.notes.substring(0, 500) : null }),
    execute: async () => {
      const { result: order } = await ingestionService.ingestMutation(async (tx) => {
        const order = await tx.labOrder.create({
          data: {
            userId: session.user.id,
            panelId: panel.id,
            notes: typeof body.notes === "string" ? body.notes.substring(0, 500) : null,
          },
          include: { panel: true, results: true },
        })

        const billingRecord = resolveLabOrderBilling({
          name: panel.name,
          priceCents: panel.priceCents,
        })

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
            labOrderId: order.id,
            metadata: {
              ...billingRecord.metadata,
              panelId: panel.id,
            },
          },
        })

        return {
          result: order,
          event: labOrderRecordToEvent(order, eventContext),
        }
      })

      return { status: 201, body: order }
    },
  })
}
