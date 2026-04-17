import { db } from '@/lib/db'

export type AdherenceStatus = 'active' | 'lapsed' | 'discontinued' | 'unknown'

export type StackAdherenceEntry = {
  compound: string
  adherenceStatus: AdherenceStatus
  lastOrderDate: string | null
  lastRefillDaysAgo: number | null
  subscriptionActive: boolean
  medicationActive: boolean
  reason: string
}

export type AdherenceReport = {
  userId: string
  entries: StackAdherenceEntry[]
  overallAdherenceRate: number // 0-1
  lapsedCompounds: string[]
}

const REFILL_WINDOW_DAYS = 45 // if no order in 45 days, considered lapsed

/**
 * Checks the user's supplement stack against their Subscription,
 * MarketplaceOrder, and Medication records to determine adherence.
 */
export async function checkStackAdherence(
  userId: string,
  supplementStack: string[],
): Promise<AdherenceReport> {
  if (supplementStack.length === 0) {
    return { userId, entries: [], overallAdherenceRate: 1, lapsedCompounds: [] }
  }

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - REFILL_WINDOW_DAYS)

  // Fetch subscription status, recent orders, and medication records in parallel
  const [subscription, recentOrders, medications] = await Promise.all([
    db.subscription.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { status: true, plan: true, updatedAt: true },
    }),

    db.marketplaceOrder.findMany({
      where: {
        userId,
        status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        orderedAt: { gte: cutoffDate },
      },
      include: {
        items: {
          include: {
            product: { select: { name: true, category: true } },
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    }),

    db.medication.findMany({
      where: { userId, category: 'supplement' },
      select: { name: true, active: true, discontinuedAt: true, updatedAt: true },
    }),
  ])

  // Build a set of recently-ordered product names (lowercased)
  const recentlyOrderedProducts = new Map<string, Date>()
  for (const order of recentOrders) {
    for (const item of order.items) {
      const productName = item.product.name.toLowerCase()
      const existing = recentlyOrderedProducts.get(productName)
      if (!existing || order.orderedAt > existing) {
        recentlyOrderedProducts.set(productName, order.orderedAt)
      }
    }
  }

  // Build medication lookup (lowercased)
  const medicationMap = new Map(
    medications.map((m) => [m.name.toLowerCase(), m]),
  )

  const subscriptionActive = subscription?.status === 'ACTIVE' || subscription?.status === 'TRIALING'

  const entries: StackAdherenceEntry[] = []

  for (const compound of supplementStack) {
    const compoundLower = compound.toLowerCase()

    const med = medicationMap.get(compoundLower)
    const medActive = med?.active ?? false
    const medDiscontinued = med?.discontinuedAt != null

    const orderDate = recentlyOrderedProducts.get(compoundLower)
    const daysSinceOrder = orderDate
      ? Math.round((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24))
      : null

    let adherenceStatus: AdherenceStatus
    let reason: string

    if (medDiscontinued) {
      adherenceStatus = 'discontinued'
      reason = `${compound} was discontinued in your medication records.`
    } else if (medActive && (orderDate || subscriptionActive)) {
      adherenceStatus = 'active'
      reason = `${compound} is active in your records${orderDate ? ` with a recent order ${daysSinceOrder} days ago` : ''}.`
    } else if (!orderDate && !medActive && !subscriptionActive) {
      adherenceStatus = 'lapsed'
      reason = `No recent refill or active subscription found for ${compound} in the last ${REFILL_WINDOW_DAYS} days.`
    } else if (daysSinceOrder != null && daysSinceOrder > REFILL_WINDOW_DAYS) {
      adherenceStatus = 'lapsed'
      reason = `Last order of ${compound} was ${daysSinceOrder} days ago — may need refill.`
    } else if (medActive) {
      adherenceStatus = 'active'
      reason = `${compound} is marked active in your medication records.`
    } else {
      adherenceStatus = 'unknown'
      reason = `Unable to determine adherence status for ${compound}.`
    }

    entries.push({
      compound,
      adherenceStatus,
      lastOrderDate: orderDate?.toISOString() ?? null,
      lastRefillDaysAgo: daysSinceOrder,
      subscriptionActive,
      medicationActive: medActive,
      reason,
    })
  }

  const activeCount = entries.filter((e) => e.adherenceStatus === 'active').length
  const overallAdherenceRate = entries.length > 0 ? activeCount / entries.length : 1
  const lapsedCompounds = entries
    .filter((e) => e.adherenceStatus === 'lapsed' || e.adherenceStatus === 'discontinued')
    .map((e) => e.compound)

  return { userId, entries, overallAdherenceRate, lapsedCompounds }
}
