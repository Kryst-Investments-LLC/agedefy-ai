import { BillingRecordStatus, ReviewSeverity, SubscriptionStatus } from "@prisma/client"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import Stripe from "stripe"

import { createReviewItem, logAudit } from "@/lib/audit"
import { buildAICreditPackBillingRecord } from "@/lib/billing"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { stripeWebhookCounter } from "@/lib/observability/telemetry"
import { isAICreditPackKey, isPricingRegionTierKey, normalizeStripeIntervalToBillingCycle, resolveDefaultMonthlyAICreditAllowance } from "@/lib/pricing"
import { stripe } from "@/lib/stripe"
import { confirmMarketplaceStripeCheckoutSession } from "@/scientist-sponsor-marketplace/backend/services/paymentLifecycleService"

export const runtime = "nodejs"

function parseSeatQuantity(rawValue: string | undefined, fallback = 1) {
  const parsed = Number(rawValue)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseNonNegativeInteger(rawValue: string | undefined) {
  const parsed = Number(rawValue)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function resolveStoredMonthlyAICreditAllowance(options: {
  explicitAllowance?: string
  legacyPerSeatAllowance?: string
  plan: string
  seatQuantity: number
}) {
  const explicitAllowance = parseNonNegativeInteger(options.explicitAllowance)

  if (explicitAllowance !== null) {
    return explicitAllowance
  }

  const legacyPerSeatAllowance = parseNonNegativeInteger(options.legacyPerSeatAllowance)

  if (legacyPerSeatAllowance !== null) {
    return legacyPerSeatAllowance * Math.max(options.seatQuantity, 1)
  }

  return resolveDefaultMonthlyAICreditAllowance(options.plan, options.seatQuantity)
}

async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const normalizedSubscription = subscription as Stripe.Subscription & { current_period_end?: number }
  const userId = subscription.metadata.userId
  const plan = subscription.metadata.plan || subscription.items.data[0]?.price.product?.toString() || "Stripe Plan"
  const billingCycle = subscription.metadata.billingCycle || normalizeStripeIntervalToBillingCycle(subscription.items.data[0]?.price.recurring?.interval)
  const firstItem = subscription.items.data[0]
  const quantity = firstItem?.quantity ?? 1
  const seatQuantity = parseSeatQuantity(subscription.metadata.seatQuantity, quantity)
  const monthlyAICreditAllowance = resolveStoredMonthlyAICreditAllowance({
    explicitAllowance: subscription.metadata.monthlyAICreditAllowance,
    legacyPerSeatAllowance: subscription.metadata.aiCreditsIncluded,
    plan,
    seatQuantity,
  })
  const amount = (firstItem?.price.unit_amount ?? 0) * quantity
  const currency = firstItem?.price.currency?.toUpperCase() ?? "USD"
  const regionTier = subscription.metadata.regionTier || null

  if (!userId) {
    await createReviewItem({
      title: "Stripe subscription missing user metadata",
      category: "billing",
      severity: ReviewSeverity.HIGH,
      details: `Subscription ${subscription.id} did not include userId metadata.`,
      relatedEntityType: "Subscription",
      relatedEntityId: subscription.id,
    })
    return
  }

  const status = subscription.status === "active"
    ? SubscriptionStatus.ACTIVE
    : subscription.status === "trialing"
      ? SubscriptionStatus.TRIALING
      : subscription.status === "past_due"
        ? SubscriptionStatus.PAST_DUE
        : SubscriptionStatus.CANCELED

  await db.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: {
      status,
      plan,
      provider: "stripe",
      billingCycle,
      regionTier,
      seatQuantity,
      monthlyAICreditAllowance,
      priceCents: amount,
      currency,
      currentPeriodEnd: normalizedSubscription.current_period_end ? new Date(normalizedSubscription.current_period_end * 1000) : null,
    },
    create: {
      userId,
      plan,
      provider: "stripe",
      status,
      billingCycle,
      regionTier,
      seatQuantity,
      monthlyAICreditAllowance,
      priceCents: amount,
      currency,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: normalizedSubscription.current_period_end ? new Date(normalizedSubscription.current_period_end * 1000) : null,
    },
  })
}

export async function POST(request: Request) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 500 })
  }

  const body = await request.text()
  const signature = (await headers()).get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    await createReviewItem({
      title: "Stripe webhook verification failed",
      category: "billing",
      severity: ReviewSeverity.CRITICAL,
      details: error instanceof Error ? error.message : "Unknown Stripe verification error",
      relatedEntityType: "Webhook",
    })
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 })
  }

  await logAudit({
    action: "billing.webhook.received",
    entityType: event.type,
    entityId: event.id,
    details: { livemode: event.livemode },
  })

  stripeWebhookCounter.add(1, { event_type: event.type, livemode: String(event.livemode) })

  switch (event.type) {
    case "checkout.session.completed": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session
      if (checkoutSession.metadata?.flow === "marketplace-escrow-checkout") {
        await confirmMarketplaceStripeCheckoutSession({
          checkoutSessionId: checkoutSession.id,
          paymentIntentId: typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : null,
          source: "stripe-webhook",
        })
        break
      }

      if (checkoutSession.metadata?.flow === "ai-credit-pack") {
        const userId = checkoutSession.metadata?.userId
        const packKey = checkoutSession.metadata?.aiCreditPackKey
        const regionTier = checkoutSession.metadata?.regionTier

        if (!userId || !packKey || !regionTier || !isAICreditPackKey(packKey) || !isPricingRegionTierKey(regionTier)) {
          await createReviewItem({
            title: "Stripe AI credit checkout missing billing metadata",
            category: "billing",
            severity: ReviewSeverity.HIGH,
            details: `Checkout session ${checkoutSession.id} could not be persisted as an AI credit purchase because required metadata was missing.`,
            relatedEntityType: "CheckoutSession",
            relatedEntityId: checkoutSession.id,
          })
          break
        }

        const billingRecord = buildAICreditPackBillingRecord(packKey, regionTier)
        const paidAt = new Date((checkoutSession.created ?? Math.floor(Date.now() / 1000)) * 1000)

        await db.billingRecord.upsert({
          where: { stripeCheckoutSessionId: checkoutSession.id },
          update: {
            userId,
            status: BillingRecordStatus.PAID,
            description: billingRecord.description,
            amountCents: Number(checkoutSession.metadata?.priceCents ?? billingRecord.amountCents),
            currency: checkoutSession.metadata?.currency ?? billingRecord.currency,
            quantity: 1,
            regionTier,
            pricingModel: billingRecord.pricingModel,
            aiCreditPackKey: packKey,
            aiCreditsDelta: Number(checkoutSession.metadata?.aiCreditsDelta ?? billingRecord.aiCreditsDelta),
            stripePaymentIntentId: typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : undefined,
            paidAt,
            metadata: billingRecord.metadata,
          },
          create: {
            userId,
            category: billingRecord.category,
            status: BillingRecordStatus.PAID,
            description: billingRecord.description,
            amountCents: Number(checkoutSession.metadata?.priceCents ?? billingRecord.amountCents),
            currency: checkoutSession.metadata?.currency ?? billingRecord.currency,
            quantity: 1,
            regionTier,
            pricingModel: billingRecord.pricingModel,
            aiCreditPackKey: packKey,
            aiCreditsDelta: Number(checkoutSession.metadata?.aiCreditsDelta ?? billingRecord.aiCreditsDelta),
            stripeCheckoutSessionId: checkoutSession.id,
            stripePaymentIntentId: typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : null,
            paidAt,
            metadata: billingRecord.metadata,
          },
        })
        break
      }

      const userId = checkoutSession.metadata?.userId
      if (userId) {
        const plan = checkoutSession.metadata?.plan ?? "Stripe Plan"
        const seatQuantity = parseSeatQuantity(checkoutSession.metadata?.seatQuantity)
        const monthlyAICreditAllowance = resolveStoredMonthlyAICreditAllowance({
          explicitAllowance: checkoutSession.metadata?.monthlyAICreditAllowance,
          legacyPerSeatAllowance: checkoutSession.metadata?.aiCreditsIncluded,
          plan,
          seatQuantity,
        })
        await db.subscription.upsert({
          where: { stripeCheckoutSessionId: checkoutSession.id },
          update: {
            userId,
            provider: "stripe",
            plan,
            billingCycle: checkoutSession.metadata?.billingCycle ?? "monthly",
            regionTier: checkoutSession.metadata?.regionTier ?? null,
            seatQuantity,
            monthlyAICreditAllowance,
            status: SubscriptionStatus.TRIALING,
            stripeSubscriptionId: typeof checkoutSession.subscription === "string" ? checkoutSession.subscription : undefined,
            priceCents: Number(checkoutSession.metadata?.priceCents ?? 0),
            currency: checkoutSession.metadata?.currency ?? "USD",
          },
          create: {
            userId,
            provider: "stripe",
            plan,
            billingCycle: checkoutSession.metadata?.billingCycle ?? "monthly",
            regionTier: checkoutSession.metadata?.regionTier ?? null,
            seatQuantity,
            monthlyAICreditAllowance,
            status: SubscriptionStatus.TRIALING,
            priceCents: Number(checkoutSession.metadata?.priceCents ?? 0),
            currency: checkoutSession.metadata?.currency ?? "USD",
            stripeCheckoutSessionId: checkoutSession.id,
            stripeSubscriptionId: typeof checkoutSession.subscription === "string" ? checkoutSession.subscription : null,
          },
        })
      }
      break
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await upsertSubscriptionFromStripe(event.data.object as Stripe.Subscription)
      break
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      await db.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: SubscriptionStatus.CANCELED,
          currentPeriodEnd: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
        },
      })
      break
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      const normalizedInvoice = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }
      const stripeSubscriptionId = typeof normalizedInvoice.subscription === "string" ? normalizedInvoice.subscription : undefined

      if (stripeSubscriptionId) {
        await db.subscription.updateMany({
          where: { stripeSubscriptionId },
          data: { status: SubscriptionStatus.PAST_DUE },
        })
      }

      await createReviewItem({
        title: "Stripe invoice payment failed",
        category: "billing",
        severity: ReviewSeverity.HIGH,
        details: `Invoice ${invoice.id} failed for subscription ${stripeSubscriptionId ?? "unknown"}.`,
        relatedEntityType: "Invoice",
        relatedEntityId: invoice.id,
      })
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}