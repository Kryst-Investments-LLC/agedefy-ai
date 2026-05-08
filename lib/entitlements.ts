import { SubscriptionStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { isPremiumPlanName } from "@/lib/pricing"

export async function getActiveSubscription(userId: string) {
  return db.subscription.findFirst({
    where: {
      userId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
    },
    orderBy: { updatedAt: "desc" },
  })
}

export async function hasPremiumEntitlement(userId: string) {
  const subscription = await getActiveSubscription(userId)

  if (!subscription) {
    return false
  }

  return isPremiumPlanName(subscription.plan)
}