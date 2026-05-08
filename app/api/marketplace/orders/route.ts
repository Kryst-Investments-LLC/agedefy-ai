import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { logAudit } from "@/lib/audit"
import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

// POST: Place a marketplace order
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const items = Array.isArray(body.items) ? body.items : []

  if (items.length === 0) {
    return NextResponse.json({ error: "At least one item is required" }, { status: 400 })
  }

  if (items.length > 20) {
    return NextResponse.json({ error: "Maximum 20 items per order" }, { status: 400 })
  }

  // Validate all products exist
  const productIds = items.map((item: { productId?: string }) =>
    typeof item.productId === "string" ? item.productId : ""
  ).filter(Boolean)

  const products = await db.product.findMany({
    where: { id: { in: productIds }, inStock: true },
  })

  const productMap = new Map(products.map((p) => [p.id, p]))

  let totalCents = 0
  const orderItems: { productId: string; quantity: number; priceCents: number }[] = []

  for (const item of items) {
    const product = productMap.get(item.productId)
    if (!product) {
      return NextResponse.json(
        { error: `Product ${item.productId} not found or out of stock` },
        { status: 404 }
      )
    }
    const quantity = typeof item.quantity === "number" && item.quantity > 0 && item.quantity <= 10
      ? Math.floor(item.quantity)
      : 1
    totalCents += product.priceCents * quantity
    orderItems.push({ productId: product.id, quantity, priceCents: product.priceCents })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, items: orderItems }),
    execute: async () => {
      const order = await db.marketplaceOrder.create({
        data: {
          userId: session.user.id,
          totalCents,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: { include: { product: true } },
        },
      })

      return { status: 201, body: order }
    },
  })
}

// GET: List user's orders
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orders = await db.marketplaceOrder.findMany({
    where: { userId: session.user.id },
    include: {
      items: { include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return NextResponse.json(orders)
}

// PATCH: Cancel a pending order
export async function PATCH(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const orderId = typeof body.id === "string" ? body.id : ""
  if (!orderId) {
    return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
  }

  const order = await db.marketplaceOrder.findUnique({ where: { id: orderId } })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (order.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (order.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only PENDING orders can be canceled" },
      { status: 409 }
    )
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, orderId, action: "cancel" }),
    execute: async () => {
      const updated = await db.marketplaceOrder.update({
        where: { id: orderId },
        data: { status: "CANCELED" },
        include: { items: { include: { product: true } } },
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "marketplace.order.canceled",
        entityType: "MarketplaceOrder",
        entityId: orderId,
      })

      logger.info("Marketplace order canceled", { orderId, actor: session.user.id })

      return { status: 200, body: updated }
    },
  })
}
