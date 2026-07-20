import { ReviewStatus } from "@prisma/client"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { requireAuthWithRole } from "@/lib/rbac"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { requireRecentMfa } from "@/lib/security/recent-mfa"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions)

  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult
  const mfaRequired = await requireRecentMfa(authResult.user.id)
  if (mfaRequired) return mfaRequired

  const payload = (await request.json()) as { status?: ReviewStatus }

  if (!payload.status || !(payload.status in ReviewStatus)) {
    return NextResponse.json({ error: "Invalid review status" }, { status: 400 })
  }

  const { id } = await context.params

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: authResult.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: authResult.user.id,
    requestFingerprint: createIdempotencyFingerprint({ actorUserId: authResult.user.id, reviewItemId: id, status: payload.status }),
    execute: async () => {
      const reviewItem = await db.reviewItem.update({
        where: { id },
        data: {
          status: payload.status,
          reviewedByUserId: authResult.user.id,
          reviewedAt: payload.status === ReviewStatus.RESOLVED || payload.status === ReviewStatus.DISMISSED ? new Date() : null,
        },
      })

      await logAudit({
        actorUserId: authResult.user.id,
        actorEmail: authResult.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "admin.review.updated",
        entityType: "ReviewItem",
        entityId: reviewItem.id,
        details: { status: reviewItem.status },
      })

      return { status: 200, body: reviewItem }
    },
  })
}
