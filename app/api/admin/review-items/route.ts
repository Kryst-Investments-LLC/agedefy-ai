import { ReviewSeverity } from "@prisma/client"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { createReviewItem, logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { requireAuthWithRole } from "@/lib/rbac"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

export async function GET() {
  const session = await getServerSession(authOptions)

  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const reviewItems = await db.reviewItem.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
  })

  return NextResponse.json(reviewItems)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const payload = (await request.json()) as {
    title?: string
    category?: string
    severity?: ReviewSeverity
    details?: string
  }

  if (!payload.title || !payload.category) {
    return NextResponse.json({ error: "Title and category are required" }, { status: 400 })
  }

  const title = payload.title
  const category = payload.category

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: authResult.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: authResult.user.id,
    requestFingerprint: createIdempotencyFingerprint({ actorUserId: authResult.user.id, payload }),
    execute: async () => {
      const reviewItem = await createReviewItem({
        title,
        category,
        severity: payload.severity ?? ReviewSeverity.MEDIUM,
        details: payload.details,
      })

      await logAudit({
        actorUserId: authResult.user.id,
        actorEmail: authResult.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "admin.review.created",
        entityType: "ReviewItem",
        entityId: reviewItem.id,
        details: { category: reviewItem.category, severity: reviewItem.severity },
      })

      return { status: 201, body: reviewItem }
    },
  })
}
