import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { PartnerDataSource } from "@prisma/client"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { partnerDataSchema } from "@/lib/validators/enterprise"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const records = await db.partnerDataRecord.findMany({
    where: { userId: session.user.id },
    orderBy: { receivedAt: "desc" },
    take: 50,
  })

  return NextResponse.json(
    records.map((record) => ({
      id: record.id,
      source: record.source,
      partnerId: record.partnerId,
      label: record.label,
      payload: record.payload,
      receivedAt: record.receivedAt.toISOString(),
    })),
  )
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = partnerDataSchema.safeParse(body)

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
      const record = await db.partnerDataRecord.create({
        data: {
          userId: session.user.id,
          source: PartnerDataSource[parsed.data.source],
          partnerId: parsed.data.partnerId,
          label: parsed.data.label,
          payload: parsed.data.payload,
        },
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        action: "partner_data.received",
        entityType: "partner_data",
        entityId: record.id,
        details: { source: parsed.data.source, label: parsed.data.label },
      })

      return { status: 201, body: { id: record.id, source: record.source, label: record.label } }
    },
  })
}
