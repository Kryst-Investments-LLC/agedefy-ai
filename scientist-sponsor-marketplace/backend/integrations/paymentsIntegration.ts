import { logger } from "@/lib/logger"
import { env } from "@/lib/env"
import { ensureStripeCustomer, stripe } from "@/lib/stripe"

export const paymentsIntegration = {
  async authorizeEscrow(input: {
    amountCents: number
    currency: string
    userId?: string
    userEmail?: string | null
    userName?: string | null
    existingStripeCustomerId?: string | null
    dealRoomId?: string
    discoveryId?: string
    subscriptionTier?: string
  }) {
    const normalizedCurrency = input.currency.toLowerCase()

    if (stripe) {
      try {
        if (input.userId && input.userEmail) {
          const customerId = await ensureStripeCustomer({
            userId: input.userId,
            email: input.userEmail,
            name: input.userName,
            stripeCustomerId: input.existingStripeCustomerId,
          })

          if (customerId) {
            const checkoutSession = await stripe.checkout.sessions.create({
              mode: "payment",
              customer: customerId,
              success_url: `${env.NEXTAUTH_URL}/scientist-sponsor?checkout=success&session_id={CHECKOUT_SESSION_ID}&dealRoom=${encodeURIComponent(input.dealRoomId ?? "")}`,
              cancel_url: `${env.NEXTAUTH_URL}/scientist-sponsor?checkout=cancelled&dealRoom=${encodeURIComponent(input.dealRoomId ?? "")}`,
              metadata: {
                userId: input.userId,
                customerId,
                dealRoomId: input.dealRoomId ?? "",
                discoveryId: input.discoveryId ?? "",
                subscriptionTier: input.subscriptionTier ?? "",
                flow: "marketplace-escrow-checkout",
              },
              payment_intent_data: {
                capture_method: "manual",
                metadata: {
                  userId: input.userId,
                  customerId,
                  dealRoomId: input.dealRoomId ?? "",
                  discoveryId: input.discoveryId ?? "",
                  subscriptionTier: input.subscriptionTier ?? "",
                  flow: "marketplace-escrow-checkout",
                },
              },
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    currency: normalizedCurrency,
                    unit_amount: input.amountCents,
                    product_data: {
                      name: "Scientist-Sponsor Marketplace Escrow",
                      description: "Funding authorization for a marketplace deal room.",
                    },
                  },
                },
              ],
            })

            logger.info("Marketplace Stripe checkout session created", {
              provider: "stripe",
              providerReference: checkoutSession.id,
              amountCents: input.amountCents,
              currency: normalizedCurrency,
              customerId,
              dealRoomId: input.dealRoomId,
            })

            return {
              provider: "stripe",
              providerReference: checkoutSession.id,
              customerId,
              checkoutUrl: checkoutSession.url,
              status: "PENDING" as const,
            }
          }
        }

        const intent = await stripe.paymentIntents.create({
          amount: input.amountCents,
          currency: normalizedCurrency,
          capture_method: "manual",
          automatic_payment_methods: { enabled: true },
          metadata: {
            product: "scientist-sponsor-marketplace",
            flow: "escrow-authorization",
            dealRoomId: input.dealRoomId ?? "",
            discoveryId: input.discoveryId ?? "",
            subscriptionTier: input.subscriptionTier ?? "",
          },
        })

        logger.info("Marketplace escrow authorization created", {
          provider: "stripe",
          providerReference: intent.id,
          amountCents: input.amountCents,
          currency: normalizedCurrency,
          status: intent.status,
        })

        return {
          provider: "stripe",
          providerReference: intent.id,
          status: "AUTHORIZED" as const,
        }
      } catch (error) {
        logger.error("Marketplace escrow authorization failed; falling back to manual mode", {
          amountCents: input.amountCents,
          currency: normalizedCurrency,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.warn("Marketplace escrow authorization is using simulated fallback because Stripe is unavailable", {
      amountCents: input.amountCents,
      currency: normalizedCurrency,
      dealRoomId: input.dealRoomId,
    })

    return {
      provider: "stripe-simulated",
      providerReference: `escrow_${normalizedCurrency}_${input.amountCents}_${Date.now()}`,
      status: "AUTHORIZED" as const,
      checkoutUrl: null,
    }
  },

  async releasePayout(providerReference: string) {
    if (stripe && providerReference.startsWith("pi_")) {
      const captured = await stripe.paymentIntents.capture(providerReference)

      logger.info("Marketplace payout released through Stripe capture", {
        providerReference,
        status: captured.status,
      })

      return {
        providerReference,
        provider: "stripe",
        status: "RELEASED" as const,
        releasedAt: new Date().toISOString(),
      }
    }

    logger.warn("Marketplace payout release is using manual fallback", {
      providerReference,
    })

    return {
      providerReference,
      provider: "manual-dev",
      status: "RELEASED" as const,
      releasedAt: new Date().toISOString(),
    }
  },
}
