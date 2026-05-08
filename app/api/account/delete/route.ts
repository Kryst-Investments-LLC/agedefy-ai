import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { logAudit } from "@/lib/audit"
import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

export async function DELETE(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 3, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)

  if (body?.confirmation !== "DELETE_MY_ACCOUNT") {
    return NextResponse.json(
      { error: "Send { \"confirmation\": \"DELETE_MY_ACCOUNT\" } to confirm permanent deletion." },
      { status: 400 },
    )
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, confirmation: body.confirmation }),
    execute: async () => {
      await logAudit({
        actorEmail: user?.email ?? session.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "account.deleted",
        entityType: "user",
        entityId: session.user.id,
        details: { email: user?.email },
      })

      await db.user.delete({ where: { id: session.user.id } })

      logger.info("Account deleted", { userId: session.user.id })

      return { status: 200, body: { message: "Account permanently deleted." } }
    },
  })
}
