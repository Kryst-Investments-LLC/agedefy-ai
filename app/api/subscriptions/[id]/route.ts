import { SubscriptionStatus } from "@prisma/client"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
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

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const payload = (await request.json()) as {
    status?: SubscriptionStatus
    monthlyAICreditAllowance?: unknown
  }
  const parsedMonthlyAICreditAllowance = parseMonthlyAICreditAllowance(payload.monthlyAICreditAllowance)

  if (typeof payload.status !== "undefined" && !(payload.status in SubscriptionStatus)) {
    return NextResponse.json({ error: "Invalid subscription status" }, { status: 400 })
  }

  if (!parsedMonthlyAICreditAllowance.valid) {
    return NextResponse.json({ error: "Invalid monthly AI allowance" }, { status: 400 })
  }

  if (!payload.status && !parsedMonthlyAICreditAllowance.provided) {
    return NextResponse.json({ error: "No subscription changes provided" }, { status: 400 })
  }

  const existingSubscription = await db.subscription.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
  })

  if (!existingSubscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({
      userId: session.user.id,
      subscriptionId: id,
      status: payload.status,
      monthlyAICreditAllowance: parsedMonthlyAICreditAllowance.provided ? parsedMonthlyAICreditAllowance.value : undefined,
    }),
    execute: async () => {
      const subscription = await db.subscription.update({
        where: { id },
        data: {
          ...(payload.status ? { status: payload.status } : {}),
          ...(parsedMonthlyAICreditAllowance.provided
            ? { monthlyAICreditAllowance: parsedMonthlyAICreditAllowance.value }
            : {}),
        },
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "subscription.updated",
        entityType: "Subscription",
        entityId: subscription.id,
        details: {
          ...(payload.status ? { status: subscription.status } : {}),
          ...(parsedMonthlyAICreditAllowance.provided
            ? { monthlyAICreditAllowance: subscription.monthlyAICreditAllowance }
            : {}),
        },
      })

      return { status: 200, body: subscription }
    },
  })
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  const existingSubscription = await db.subscription.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
  })

  if (!existingSubscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, subscriptionId: id, action: "delete" }),
    execute: async () => {
      await db.subscription.delete({ where: { id } })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "subscription.deleted",
        entityType: "Subscription",
        entityId: id,
        details: { plan: existingSubscription.plan },
      })

      return { status: 200, body: { success: true } }
    },
  })
}