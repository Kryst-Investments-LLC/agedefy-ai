import { SUBSCRIPTION_TIERS } from "@/scientist-sponsor-marketplace/shared/constants"
import type { BillingQuote } from "@/scientist-sponsor-marketplace/shared/types/entities"
import { paymentsIntegration } from "@/scientist-sponsor-marketplace/backend/integrations/paymentsIntegration"

export const billingService = {
  quote(grossAmountCents: number, subscriptionTier: keyof typeof SUBSCRIPTION_TIERS): BillingQuote {
    const tier = SUBSCRIPTION_TIERS[subscriptionTier]
    const platformFeeCents = Math.round(grossAmountCents * (tier.platformFeeBps / 10000))
    const transactionFeeCents = Math.round(grossAmountCents * (tier.transactionFeeBps / 10000))
    const payoutCents = Math.max(grossAmountCents - platformFeeCents - transactionFeeCents, 0)

    return {
      subscriptionTier,
      grossAmountCents,
      platformFeeCents,
      transactionFeeCents,
      payoutCents,
    }
  },

  async createEscrowAuthorization(input: {
    grossAmountCents: number
    currency: string
    subscriptionTier: keyof typeof SUBSCRIPTION_TIERS
    userId?: string
    userEmail?: string | null
    userName?: string | null
    existingStripeCustomerId?: string | null
    dealRoomId?: string
    discoveryId?: string
  }) {
    const quote = this.quote(input.grossAmountCents, input.subscriptionTier)
    const authorization = await paymentsIntegration.authorizeEscrow({
      amountCents: input.grossAmountCents,
      currency: input.currency,
      userId: input.userId,
      userEmail: input.userEmail,
      userName: input.userName,
      existingStripeCustomerId: input.existingStripeCustomerId,
      dealRoomId: input.dealRoomId,
      discoveryId: input.discoveryId,
      subscriptionTier: input.subscriptionTier,
    })
    return { ...quote, ...authorization }
  },

  async releasePayout(providerReference: string) {
    return paymentsIntegration.releasePayout(providerReference)
  },
}
