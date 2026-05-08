import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { resolveDefaultMonthlyAICreditAllowance } from "@/lib/pricing"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { subscriptionSchema } from "@/lib/validators/workspace"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await request.json()
  const parsedPayload = subscriptionSchema.safeParse(payload)

  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid subscription payload", details: parsedPayload.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, payload: parsedPayload.data }),
    execute: async () => {
      const subscription = await db.subscription.create({
        data: {
          userId: session.user.id,
          plan: parsedPayload.data.plan,
          status: parsedPayload.data.status,
          priceCents: parsedPayload.data.priceCents,
          currency: parsedPayload.data.currency.toUpperCase(),
          billingCycle: parsedPayload.data.billingCycle,
          monthlyAICreditAllowance:
            parsedPayload.data.monthlyAICreditAllowance
            ?? resolveDefaultMonthlyAICreditAllowance(parsedPayload.data.plan),
          currentPeriodEnd: parsedPayload.data.currentPeriodEnd ? new Date(parsedPayload.data.currentPeriodEnd) : null,
        },
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "subscription.created",
        entityType: "Subscription",
        entityId: subscription.id,
        details: { plan: subscription.plan, status: subscription.status },
      })

      return { status: 201, body: subscription }
    },
  })
}