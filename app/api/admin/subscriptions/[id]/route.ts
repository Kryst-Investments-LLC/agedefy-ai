import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { blockWriteDuringImpersonation } from "@/lib/admin/impersonation"
import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { getPricingPlanDefinition } from "@/lib/pricing"
import { applyRateLimit } from "@/lib/rate-limit"
import { requireAuthWithRole } from "@/lib/rbac"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

type RouteContext = {
  params: Promise<{ id: string }>
}

function parseMonthlyAICreditAllowance(value: unknown) {
  if (typeof value === "undefined") {
    return {
      provided: false,
      value: undefined,
      valid: true,
    }
  }

  if (value === null) {
    return {
      provided: true,
      value: null,
      valid: true,
    }
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    return {
      provided: true,
      value: undefined,
      valid: false,
    }
  }

  return {
    provided: true,
    value: parsed,
    valid: true,
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const impersonationBlock = blockWriteDuringImpersonation(authResult.user.id)
  if (impersonationBlock) return impersonationBlock

  const { id } = await context.params
  const payload = (await request.json()) as { monthlyAICreditAllowance?: unknown }
  const parsedMonthlyAICreditAllowance = parseMonthlyAICreditAllowance(payload.monthlyAICreditAllowance)

  if (!parsedMonthlyAICreditAllowance.provided) {
    return NextResponse.json({ error: "monthlyAICreditAllowance is required" }, { status: 400 })
  }

  if (!parsedMonthlyAICreditAllowance.valid) {
    return NextResponse.json({ error: "Invalid monthly AI allowance" }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: authResult.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: authResult.user.id,
    requestFingerprint: createIdempotencyFingerprint({
      adminId: authResult.user.id,
      subscriptionId: id,
      monthlyAICreditAllowance: parsedMonthlyAICreditAllowance.value,
    }),
    execute: async () => {
      const existingSubscription = await db.subscription.findUnique({
        where: { id },
        select: {
          id: true,
          plan: true,
          userId: true,
          monthlyAICreditAllowance: true,
        },
      })

      if (!existingSubscription) {
        return { status: 404, body: { error: "Subscription not found" } }
      }

      const planDefinition = getPricingPlanDefinition(existingSubscription.plan)
      if (planDefinition?.key !== "enterprise") {
        return { status: 400, body: { error: "Only enterprise subscriptions can be edited from this route" } }
      }

      const updatedSubscription = await db.subscription.update({
        where: { id },
        data: {
          monthlyAICreditAllowance: parsedMonthlyAICreditAllowance.value,
        },
        select: {
          id: true,
          plan: true,
          status: true,
          monthlyAICreditAllowance: true,
          updatedAt: true,
        },
      })

      await logAudit({
        actorUserId: authResult.user.id,
        actorEmail: authResult.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "admin.subscription.allowance.updated",
        entityType: "Subscription",
        entityId: updatedSubscription.id,
        details: {
          plan: existingSubscription.plan,
          targetUserId: existingSubscription.userId,
          previousMonthlyAICreditAllowance: existingSubscription.monthlyAICreditAllowance,
          monthlyAICreditAllowance: updatedSubscription.monthlyAICreditAllowance,
        },
      })

      return { status: 200, body: updatedSubscription }
    },
  })
}