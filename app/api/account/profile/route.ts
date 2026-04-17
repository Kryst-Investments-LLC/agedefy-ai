import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { profileSchema } from "@/lib/validators/workspace"

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await request.json()
  const parsedPayload = profileSchema.safeParse(payload)

  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid profile payload", details: parsedPayload.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, payload: parsedPayload.data }),
    execute: async () => {
      const profile = await db.userProfile.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          longevityGoal: parsedPayload.data.longevityGoal,
          riskTolerance: parsedPayload.data.riskTolerance,
        },
        update: {
          longevityGoal: parsedPayload.data.longevityGoal,
          riskTolerance: parsedPayload.data.riskTolerance,
        },
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "profile.updated",
        entityType: "UserProfile",
        entityId: profile.id,
        details: { longevityGoal: profile.longevityGoal, riskTolerance: profile.riskTolerance },
      })

      return { status: 200, body: profile }
    },
  })
}