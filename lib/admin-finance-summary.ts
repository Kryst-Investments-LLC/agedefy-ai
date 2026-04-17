import {
  AICreditSource,
  BillingRecordCategory,
  BillingRecordStatus,
  SubscriptionStatus,
} from "@prisma/client"

import { formatAICreditSource } from "@/lib/ai-credits"
import { db } from "@/lib/db"

const activeSubscriptionStatuses: SubscriptionStatus[] = [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]
const committedBillingStatuses: BillingRecordStatus[] = [BillingRecordStatus.PENDING, BillingRecordStatus.PAID]

export type AdminFinanceSummary = {
  generatedAt: string
  revenue: {
    totalRecognizedCents: number
    topUpRevenueCents: number
    telemedicineRevenueCents: number
    labRevenueCents: number
    byCategory: Array<{
      category: BillingRecordCategory
      amountCents: number
      recordCount: number
    }>
  }
  subscriptions: {
    activeCount: number
    estimatedMonthlyRecurringRevenueCents: number
    plans: Array<{
      plan: string
      activeSubscriptions: number
      seatCount: number
      estimatedMonthlyRecurringRevenueCents: number
    }>
  }
  aiCredits: {
    purchasedCreditsSold: number
    purchasedCreditsConsumed: number
    purchasedCreditsRemaining: number
    totalPaidCreditsConsumed: number
    pendingReservedCredits: number
    currentMonthAllowanceConsumed: number
    consumedBySource: Array<{
      source: AICreditSource
      label: string
      creditsConsumed: number
    }>
  }
}

function getCurrentMonthWindow(now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const nextResetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  return { monthStart, nextResetAt }
}

function getPositiveUsage(value: number | null | undefined) {
  if (!value || value >= 0) {
    return 0
  }

  return Math.abs(value)
}

function normalizeMonthlyRecurringRevenue(priceCents: number, billingCycle: string) {
  if (billingCycle === "yearly") {
    return Math.round(priceCents / 12)
  }

  return priceCents
}

export async function getAdminFinanceSummary(): Promise<AdminFinanceSummary> {
  const { monthStart, nextResetAt } = getCurrentMonthWindow()

  const [
    revenueByCategory,
    activeSubscriptions,
    purchasedCreditsAggregate,
    committedPurchasedUsageAggregate,
    paidUsageBySource,
    pendingReservedAggregate,
    currentMonthAllowanceAggregate,
  ] = await Promise.all([
    db.billingRecord.groupBy({
      by: ["category"],
      where: {
        status: BillingRecordStatus.PAID,
      },
      _sum: {
        amountCents: true,
      },
      _count: {
        _all: true,
      },
    }),
    db.subscription.findMany({
      where: {
        status: { in: activeSubscriptionStatuses },
      },
      select: {
        plan: true,
        priceCents: true,
        billingCycle: true,
        seatQuantity: true,
      },
    }),
    db.billingRecord.aggregate({
      where: {
        category: BillingRecordCategory.AI_CREDIT_PACK,
        status: BillingRecordStatus.PAID,
      },
      _sum: {
        aiCreditsDelta: true,
      },
    }),
    db.billingRecord.aggregate({
      where: {
        category: BillingRecordCategory.AI_CREDIT_USAGE,
        aiCreditSource: AICreditSource.PURCHASED_TOP_UP,
        status: { in: committedBillingStatuses },
      },
      _sum: {
        aiCreditsDelta: true,
      },
    }),
    db.billingRecord.groupBy({
      by: ["aiCreditSource"],
      where: {
        category: BillingRecordCategory.AI_CREDIT_USAGE,
        status: BillingRecordStatus.PAID,
      },
      _sum: {
        aiCreditsDelta: true,
      },
    }),
    db.billingRecord.aggregate({
      where: {
        category: BillingRecordCategory.AI_CREDIT_USAGE,
        status: BillingRecordStatus.PENDING,
      },
      _sum: {
        aiCreditsDelta: true,
      },
    }),
    db.billingRecord.aggregate({
      where: {
        category: BillingRecordCategory.AI_CREDIT_USAGE,
        aiCreditSource: {
          in: [AICreditSource.SUBSCRIPTION_ALLOWANCE, AICreditSource.ENTERPRISE_POOL],
        },
        status: BillingRecordStatus.PAID,
        createdAt: {
          gte: monthStart,
          lt: nextResetAt,
        },
      },
      _sum: {
        aiCreditsDelta: true,
      },
    }),
  ])

  const revenueByCategoryMap = new Map(
    revenueByCategory.map((entry) => [
      entry.category,
      {
        amountCents: entry._sum.amountCents ?? 0,
        recordCount: entry._count._all,
      },
    ]),
  )

  const subscriptionPlans = new Map<string, { activeSubscriptions: number; seatCount: number; estimatedMonthlyRecurringRevenueCents: number }>()
  let estimatedMonthlyRecurringRevenueCents = 0

  for (const subscription of activeSubscriptions) {
    const planSummary = subscriptionPlans.get(subscription.plan) ?? {
      activeSubscriptions: 0,
      seatCount: 0,
      estimatedMonthlyRecurringRevenueCents: 0,
    }
    const estimatedMonthlyRevenue = normalizeMonthlyRecurringRevenue(subscription.priceCents, subscription.billingCycle)

    planSummary.activeSubscriptions += 1
    planSummary.seatCount += Math.max(subscription.seatQuantity, 1)
    planSummary.estimatedMonthlyRecurringRevenueCents += estimatedMonthlyRevenue
    estimatedMonthlyRecurringRevenueCents += estimatedMonthlyRevenue
    subscriptionPlans.set(subscription.plan, planSummary)
  }

  const consumedBySource = paidUsageBySource
    .filter((entry): entry is typeof entry & { aiCreditSource: AICreditSource } => entry.aiCreditSource !== null)
    .map((entry) => ({
      source: entry.aiCreditSource,
      label: formatAICreditSource(entry.aiCreditSource) ?? entry.aiCreditSource.toLowerCase(),
      creditsConsumed: getPositiveUsage(entry._sum.aiCreditsDelta),
    }))
    .sort((left, right) => right.creditsConsumed - left.creditsConsumed)

  const purchasedCreditsSold = purchasedCreditsAggregate._sum.aiCreditsDelta ?? 0
  const purchasedCreditsConsumed = getPositiveUsage(committedPurchasedUsageAggregate._sum?.aiCreditsDelta)

  return {
    generatedAt: new Date().toISOString(),
    revenue: {
      totalRecognizedCents:
        (revenueByCategoryMap.get(BillingRecordCategory.AI_CREDIT_PACK)?.amountCents ?? 0) +
        (revenueByCategoryMap.get(BillingRecordCategory.TELEMEDICINE_CONSULTATION)?.amountCents ?? 0) +
        (revenueByCategoryMap.get(BillingRecordCategory.LAB_ORDER)?.amountCents ?? 0),
      topUpRevenueCents: revenueByCategoryMap.get(BillingRecordCategory.AI_CREDIT_PACK)?.amountCents ?? 0,
      telemedicineRevenueCents: revenueByCategoryMap.get(BillingRecordCategory.TELEMEDICINE_CONSULTATION)?.amountCents ?? 0,
      labRevenueCents: revenueByCategoryMap.get(BillingRecordCategory.LAB_ORDER)?.amountCents ?? 0,
      byCategory: Object.values(BillingRecordCategory).map((category) => ({
        category,
        amountCents: revenueByCategoryMap.get(category)?.amountCents ?? 0,
        recordCount: revenueByCategoryMap.get(category)?.recordCount ?? 0,
      })),
    },
    subscriptions: {
      activeCount: activeSubscriptions.length,
      estimatedMonthlyRecurringRevenueCents,
      plans: Array.from(subscriptionPlans.entries())
        .map(([plan, summary]) => ({
          plan,
          ...summary,
        }))
        .sort((left, right) => right.estimatedMonthlyRecurringRevenueCents - left.estimatedMonthlyRecurringRevenueCents),
    },
    aiCredits: {
      purchasedCreditsSold,
      purchasedCreditsConsumed,
      purchasedCreditsRemaining: Math.max(purchasedCreditsSold - purchasedCreditsConsumed, 0),
      totalPaidCreditsConsumed: consumedBySource.reduce((total, entry) => total + entry.creditsConsumed, 0),
      pendingReservedCredits: getPositiveUsage(pendingReservedAggregate._sum.aiCreditsDelta),
      currentMonthAllowanceConsumed: getPositiveUsage(currentMonthAllowanceAggregate._sum.aiCreditsDelta),
      consumedBySource,
    },
  }
}