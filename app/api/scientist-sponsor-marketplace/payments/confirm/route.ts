import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { CircuitBreakerOpenError, executeWithCircuitBreaker } from "@/lib/circuit-breaker"
import { createIdempotencyFingerprint, executeIdempotentJsonMutation } from "@/lib/idempotency"
import { applyRateLimit } from "@/lib/rate-limit"
import { stripe } from "@/lib/stripe"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { confirmMarketplaceStripeCheckoutSession } from "@/scientist-sponsor-marketplace/backend/services/paymentLifecycleService"

const confirmMarketplacePaymentSchema = z.object({
  sessionId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 })
  }

  const stripeClient = stripe

  const body = await request.json().catch(() => null)
  const parsed = confirmMarketplacePaymentSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  try {
    return await executeIdempotentJsonMutation({
      tenantId: tenantContext.tenantId,
      route: "/api/scientist-sponsor-marketplace/payments/confirm",
      method: "POST",
      key: request.headers.get("idempotency-key"),
      actorUserId: session.user.id,
      requestFingerprint: createIdempotencyFingerprint({ sessionId: parsed.data.sessionId, actorUserId: session.user.id }),
      execute: async () => {
        const checkoutSession = await executeWithCircuitBreaker({
          dependency: "stripe-marketplace-confirmation",
          execute: async () => stripeClient.checkout.sessions.retrieve(parsed.data.sessionId),
        })

        if (checkoutSession.metadata?.flow !== "marketplace-escrow-checkout") {
          return { status: 400, body: { error: "Invalid checkout session" } }
        }

        if (session.user.role !== "ADMIN" && checkoutSession.metadata?.userId !== session.user.id) {
          return { status: 403, body: { error: "Forbidden" } }
        }

        const paymentIntentId = typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : null

        if (checkoutSession.status !== "complete" || !paymentIntentId) {
          return { status: 409, body: { error: "Checkout session is not ready for confirmation" } }
        }

        const transaction = await executeWithCircuitBreaker({
          dependency: "stripe-marketplace-confirmation",
          execute: async () => confirmMarketplaceStripeCheckoutSession({
            checkoutSessionId: checkoutSession.id,
            paymentIntentId,
            source: "checkout-success",
          }),
        })

        if (!transaction) {
          return { status: 404, body: { error: "Marketplace transaction not found" } }
        }

        await logAudit({
          actorUserId: session.user.id,
          tenantId: tenantContext.tenantId,
          action: "marketplace.payment.confirmed",
          entityType: "MarketplaceTransaction",
          entityId: transaction.id,
          details: {
            checkoutSessionId: checkoutSession.id,
            paymentIntentId,
            dealRoomId: transaction.dealRoomId,
          },
        })

        return {
          status: 200,
          body: {
            id: transaction.id,
            dealRoomId: transaction.dealRoomId,
            status: transaction.status,
            providerReference: transaction.providerReference,
          },
        }
      },
    })
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      return NextResponse.json(
        { error: "Marketplace payment confirmation is temporarily unavailable. Please retry shortly." },
        {
          status: 503,
          headers: error.retryAt
            ? { "Retry-After": String(Math.max(1, Math.ceil((error.retryAt.getTime() - Date.now()) / 1000))) }
            : undefined,
        },
      )
    }

    throw error
  }
}