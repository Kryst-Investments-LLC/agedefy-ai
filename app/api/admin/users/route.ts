import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { blockWriteDuringImpersonation } from "@/lib/admin/impersonation"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { applyRateLimit } from "@/lib/rate-limit"
import { requireAuthWithRole } from "@/lib/rbac"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

// PATCH: Update a user's role (admin only)
export async function PATCH(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult
  const user = authResult.user

  const impersonationBlock = await blockWriteDuringImpersonation(user.id)
  if (impersonationBlock) return impersonationBlock

  const body = await request.json()
  const userId = typeof body.userId === "string" ? body.userId : null
  const role = typeof body.role === "string" ? body.role : null

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role are required" }, { status: 400 })
  }

  const validRoles = ["MEMBER", "ADMIN", "CLINICIAN", "RESEARCHER"]
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: authResult.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: authResult.user.id,
    requestFingerprint: createIdempotencyFingerprint({ adminId: authResult.user.id, userId, role }),
    execute: async () => {
      const targetUser = await db.user.findUnique({ where: { id: userId } })
      if (!targetUser) {
        return { status: 404, body: { error: "User not found" } }
      }

      const updated = await db.user.update({
        where: { id: userId },
        data: { role: role as "MEMBER" | "ADMIN" | "CLINICIAN" | "RESEARCHER" },
        select: { id: true, email: true, role: true },
      })

      await db.auditLog.create({
        data: {
          actorUserId: authResult.user.id,
          actorEmail: authResult.user.email ?? undefined,
          action: "USER_ROLE_CHANGE",
          entityType: "User",
          entityId: userId,
          details: JSON.stringify({ from: targetUser.role, to: role }),
        },
      })

      return { status: 200, body: updated }
    },
  })
}

