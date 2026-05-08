import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { buildAICreditPackBillingRecord } from "@/lib/billing"
import { CircuitBreakerOpenError, executeWithCircuitBreaker } from "@/lib/circuit-breaker"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { createIdempotencyFingerprint, executeIdempotentJsonMutation } from "@/lib/idempotency"
import { logger } from "@/lib/logger"
import {
  getAICreditPack,
  getSelfServePricingPlan,
  isAICreditPackKey,
  isBillingCycle,
  isPricingRegionTierKey,
  isSelfServePlanKey,
  resolveDefaultMonthlyAICreditAllowance,
  resolveSubscriptionPrice,
  type AICreditPackKey,
  type BillingCycle,
  type PricingRegionTierKey,
  type SelfServePlanKey,
} from "@/lib/pricing"
import { applyRateLimit } from "@/lib/rate-limit"
import { ensureStripeCustomer, stripe } from "@/lib/stripe"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

export async function POST(request: Request) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 })
  }

  const stripeClient = stripe

  const payload = (await request.json()) as {
    planKey?: string
    aiCreditPackKey?: string
    regionTier?: string
    billingCycle?: string
  }
  const planKey = payload.planKey
  const aiCreditPackKey = payload.aiCreditPackKey
  const regionTier = payload.regionTier ?? "tier1"
  const billingCycle = payload.billingCycle ?? "monthly"
  const selectedPlanKey: SelfServePlanKey | null = planKey && isSelfServePlanKey(planKey) ? planKey : null
  const selectedAICreditPackKey: AICreditPackKey | null = aiCreditPackKey && isAICreditPackKey(aiCreditPackKey) ? aiCreditPackKey : null
  const selectedRegionTier: PricingRegionTierKey | null = isPricingRegionTierKey(regionTier) ? regionTier : null
  const selectedBillingCycle: BillingCycle | null = isBillingCycle(billingCycle) ? billingCycle : null
  const isSubscriptionCheckout = selectedPlanKey !== null
  const isAICreditPackCheckout = selectedAICreditPackKey !== null

  if (!selectedRegionTier) {
    return NextResponse.json({ error: "Invalid pricing region" }, { status: 400 })
  }

  if (isSubscriptionCheckout === isAICreditPackCheckout) {
    return NextResponse.json({ error: "Select exactly one checkout item" }, { status: 400 })
  }

  if (planKey && (!selectedPlanKey || !selectedBillingCycle)) {
    return NextResponse.json({ error: "Invalid plan selection" }, { status: 400 })
  }

  if (aiCreditPackKey && !selectedAICreditPackKey) {
    return NextResponse.json({ error: "Invalid AI credit pack selection" }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  try {
    return await executeIdempotentJsonMutation({
      tenantId: tenantContext.tenantId,
      route: "/api/stripe/checkout",
      method: "POST",
      key: request.headers.get("idempotency-key"),
      actorUserId: user.id,
      requestFingerprint: createIdempotencyFingerprint(
        isSubscriptionCheckout
          ? { userId: user.id, planKey: selectedPlanKey, regionTier: selectedRegionTier, billingCycle: selectedBillingCycle }
          : { userId: user.id, aiCreditPackKey: selectedAICreditPackKey, regionTier: selectedRegionTier, checkoutMode: "payment" },
      ),
      execute: async () => {
        const customerId = await executeWithCircuitBreaker({
          dependency: "stripe-billing-write",
          execute: async () => ensureStripeCustomer({
            userId: user.id,
            email: user.email,
            name: user.name,
            stripeCustomerId: user.stripeCustomerId,
          }),
        })

        if (!customerId) {
          return {
            status: 500,
            body: { error: "Stripe customer creation unavailable" },
          }
        }

        let checkoutSession
        let auditDetails: Record<string, string | number | null | undefined>
        let logDetails: Record<string, string | number | null | undefined>

        if (isSubscriptionCheckout) {
          const plan = getSelfServePricingPlan(selectedPlanKey)
          const resolvedPrice = resolveSubscriptionPrice(selectedPlanKey, selectedRegionTier, selectedBillingCycle as BillingCycle)
          const existingSubscriptionCount = await db.subscription.count({ where: { userId: user.id } })
          const seatQuantity = plan.minSeats ?? 1
          const monthlyAICreditAllowance = resolveDefaultMonthlyAICreditAllowance(selectedPlanKey, seatQuantity) ?? 0
          const totalAmountCents = resolvedPrice.amountCents * seatQuantity

          checkoutSession = await executeWithCircuitBreaker({
            dependency: "stripe-billing-write",
            execute: async () => stripeClient.checkout.sessions.create({
              mode: "subscription",
              customer: customerId,
              success_url: `${env.NEXTAUTH_URL}/account?checkout=success`,
              cancel_url: `${env.NEXTAUTH_URL}/pricing?checkout=cancelled&region=${selectedRegionTier}&cycle=${selectedBillingCycle}`,
              allow_promotion_codes: true,
              metadata: {
                flow: "subscription",
                userId: user.id,
                plan: plan.name,
                planKey: selectedPlanKey,
                billingCycle: selectedBillingCycle,
                regionTier: selectedRegionTier,
                aiCreditsIncluded: String(plan.aiCreditsPerMonth),
                monthlyAICreditAllowance: String(monthlyAICreditAllowance),
                priceCents: String(totalAmountCents),
                currency: resolvedPrice.currency,
                seatQuantity: String(seatQuantity),
              },
              subscription_data: {
                trial_period_days: existingSubscriptionCount === 0 ? plan.trialDays : undefined,
                metadata: {
                  flow: "subscription",
                  userId: user.id,
                  plan: plan.name,
                  planKey: selectedPlanKey,
                  billingCycle: selectedBillingCycle,
                  regionTier: selectedRegionTier,
                  aiCreditsIncluded: String(plan.aiCreditsPerMonth),
                  monthlyAICreditAllowance: String(monthlyAICreditAllowance),
                  priceCents: String(totalAmountCents),
                  currency: resolvedPrice.currency,
                  seatQuantity: String(seatQuantity),
                },
              },
              line_items: [
                {
                  quantity: seatQuantity,
                  price_data: {
                    currency: resolvedPrice.currency.toLowerCase(),
                    recurring: {
                      interval: resolvedPrice.interval as "month" | "year",
                    },
                    product_data: {
                      name: plan.name,
                      description: plan.description,
                    },
                    unit_amount: resolvedPrice.amountCents,
                  },
                },
              ],
            }),
          })

          auditDetails = { checkoutType: "subscription", plan: plan.name, customerId, billingCycle: selectedBillingCycle, regionTier: selectedRegionTier, totalAmountCents, seatQuantity }
          logDetails = { plan: plan.name, billingCycle: selectedBillingCycle, regionTier: selectedRegionTier, totalAmountCents, seatQuantity, sessionId: checkoutSession.id }
        } else {
          const selectedPackKey = selectedAICreditPackKey as AICreditPackKey
          const pack = getAICreditPack(selectedPackKey)
          const billingRecord = buildAICreditPackBillingRecord(selectedPackKey, selectedRegionTier)

          checkoutSession = await executeWithCircuitBreaker({
            dependency: "stripe-billing-write",
            execute: async () => stripeClient.checkout.sessions.create({
              mode: "payment",
              customer: customerId,
              success_url: `${env.NEXTAUTH_URL}/account?checkout=success&flow=ai-credits`,
              cancel_url: `${env.NEXTAUTH_URL}/pricing?checkout=cancelled&region=${selectedRegionTier}&cycle=${billingCycle}`,
              allow_promotion_codes: true,
              metadata: {
                flow: "ai-credit-pack",
                userId: user.id,
                aiCreditPackKey: pack.key,
                regionTier: selectedRegionTier,
                aiCreditsDelta: String(billingRecord.aiCreditsDelta),
                priceCents: String(billingRecord.amountCents),
                currency: billingRecord.currency,
              },
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    currency: billingRecord.currency.toLowerCase(),
                    product_data: {
                      name: pack.name,
                      description: pack.description,
                    },
                    unit_amount: billingRecord.amountCents,
                  },
                },
              ],
            }),
          })

          auditDetails = {
            checkoutType: "ai-credit-pack",
            packKey: pack.key,
            customerId,
            regionTier: selectedRegionTier,
            totalAmountCents: billingRecord.amountCents,
            aiCreditsDelta: billingRecord.aiCreditsDelta,
          }
          logDetails = {
            packKey: pack.key,
            regionTier: selectedRegionTier,
            totalAmountCents: billingRecord.amountCents,
            aiCreditsDelta: billingRecord.aiCreditsDelta,
            sessionId: checkoutSession.id,
          }
        }

        await logAudit({
          actorUserId: user.id,
          actorEmail: user.email,
          tenantId: tenantContext.tenantId,
          action: "billing.checkout.created",
          entityType: "CheckoutSession",
          entityId: checkoutSession.id,
          details: auditDetails,
        })

        logger.info("Stripe checkout created", {
          userId: user.id,
          tenantId: tenantContext.tenantId,
          ...logDetails,
        })

        return {
          status: 200,
          body: { url: checkoutSession.url },
        }
      },
    })
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      return NextResponse.json(
        { error: "Stripe is temporarily unavailable. Please retry shortly." },
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