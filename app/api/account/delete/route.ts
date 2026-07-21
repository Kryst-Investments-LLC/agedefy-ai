import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { eraseUserResidualPii } from "@/lib/account/erasure"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { logAudit } from "@/lib/audit"
import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { requireRecentMfa } from "@/lib/security/recent-mfa"

export async function DELETE(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 3, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const mfaRequired = await requireRecentMfa(session.user.id)
  if (mfaRequired) return mfaRequired

  const body = await request.json().catch(() => null)

  if (body?.confirmation !== "DELETE_MY_ACCOUNT") {
    return NextResponse.json(
      { error: "Send { \"confirmation\": \"DELETE_MY_ACCOUNT\" } to confirm permanent deletion." },
      { status: 400 },
    )
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, confirmation: body.confirmation }),
    execute: async () => {
      // Right to erasure (GDPR Art. 17). The deletion audit is recorded WITHOUT
      // the email so no new PII enters the tamper-evident chain (only entityId
      // identifies the user).
      await logAudit({
        tenantId: tenantContext.tenantId,
        action: "account.deleted",
        entityType: "user",
        entityId: session.user.id,
      })

      // Erase residual PII (idempotency cache + audit actorEmail) that a plain
      // cascade would leave behind, then delete the user.
      await eraseUserResidualPii(session.user.id)

      await db.user.delete({ where: { id: session.user.id } })

      logger.info("Account deleted", { userId: session.user.id })

      return { status: 200, body: { message: "Account permanently deleted." } }
    },
  })
}
