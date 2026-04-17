import { billingService } from "@/scientist-sponsor-marketplace/backend/services/billingService"
import { dealRoomService } from "@/scientist-sponsor-marketplace/backend/services/dealRoomService"
import { postDealRoomMessage } from "@/scientist-sponsor-marketplace/backend/services/messageThreadService"
import { notifyMarketplaceUser } from "@/scientist-sponsor-marketplace/backend/services/notificationService"
import { transactionService } from "@/scientist-sponsor-marketplace/backend/services/transactionService"
import { logMarketplaceAuditEvent } from "@/scientist-sponsor-marketplace/backend/services/auditService"
import { approveAndReleaseMarketplaceTransaction, markMarketplaceMilestoneComplete, rejectMarketplaceTransactionReview } from "@/scientist-sponsor-marketplace/backend/services/paymentLifecycleService"
import type { MarketplaceRole } from "@/scientist-sponsor-marketplace/shared/types/entities"

export const dealWorkflow = {
  async negotiate(input: { dealRoomId: string; termsPatch: Record<string, unknown>; actorRole: MarketplaceRole; actorUserId?: string | null }) {
    const current = await dealRoomService.getById(input.dealRoomId)
    const nextTerms = { ...((current as any)?.agreementTerms ?? {}), ...input.termsPatch }
    const updated = await dealRoomService.update(input.dealRoomId, {
      status: "NEGOTIATING",
      agreementTerms: nextTerms,
      lastActivityAt: new Date().toISOString(),
    })

    await logMarketplaceAuditEvent({
      dealRoomId: input.dealRoomId,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole,
      action: "deal.negotiated",
      entityType: "DealRoom",
      entityId: input.dealRoomId,
      details: input.termsPatch,
    })

    return updated
  },

  async sendMessage(input: { dealRoomId: string; actorRole: MarketplaceRole; actorUserId?: string | null; body: string; attachments?: Array<{ name: string; url: string; contentType?: string }> }) {
    return postDealRoomMessage({
      dealRoomId: input.dealRoomId,
      senderUserId: input.actorUserId,
      senderRole: input.actorRole,
      body: input.body,
      attachments: input.attachments,
    })
  },

  async buildAgreement(input: { dealRoomId: string; agreementTerms: Record<string, unknown>; actorRole: MarketplaceRole; actorUserId?: string | null }) {
    const updated = await dealRoomService.update(input.dealRoomId, {
      agreementTerms: input.agreementTerms,
      agreementStatus: "REVIEW",
      status: "AGREEMENT_PENDING",
    })

    await logMarketplaceAuditEvent({
      dealRoomId: input.dealRoomId,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole,
      action: "agreement.built",
      entityType: "DealRoom",
      entityId: input.dealRoomId,
      details: { keys: Object.keys(input.agreementTerms) },
    })

    return updated
  },

  async approveAgreement(input: { dealRoomId: string; actorRole: MarketplaceRole; actorUserId?: string | null; approvalNote?: string }) {
    const updated = await dealRoomService.update(input.dealRoomId, {
      agreementStatus: "APPROVED",
    })

    await logMarketplaceAuditEvent({
      dealRoomId: input.dealRoomId,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole,
      action: "agreement.approved",
      entityType: "DealRoom",
      entityId: input.dealRoomId,
      details: { approvalNote: input.approvalNote ?? null },
    })

    return updated
  },

  async processPayment(input: {
    dealRoomId: string
    discoveryId: string
    sponsorId: string
    sponsorUserId: string
    sponsorUserEmail: string | null
    sponsorUserName: string | null
    scientistUserId: string
    amountCents: number
    currency: string
    subscriptionTier: "scout" | "growth" | "strategic"
  }) {
    const authorization = await billingService.createEscrowAuthorization({
      grossAmountCents: input.amountCents,
      currency: input.currency,
      subscriptionTier: input.subscriptionTier,
      userId: input.sponsorUserId,
      userEmail: input.sponsorUserEmail,
      userName: input.sponsorUserName,
      dealRoomId: input.dealRoomId,
      discoveryId: input.discoveryId,
    })
    const transaction = await transactionService.create({
      dealRoomId: input.dealRoomId,
      discoveryId: input.discoveryId,
      sponsorId: input.sponsorId,
      amountCents: input.amountCents,
      currency: input.currency,
      platformFeeCents: authorization.platformFeeCents,
      transactionFeeCents: authorization.transactionFeeCents,
      payoutCents: authorization.payoutCents,
      status: authorization.status,
      providerReference: authorization.providerReference,
      metadata: authorization,
    })

    if (authorization.status === "PENDING" && "checkoutUrl" in authorization && authorization.checkoutUrl) {
      await postDealRoomMessage({
        dealRoomId: input.dealRoomId,
        senderUserId: input.sponsorUserId,
        senderRole: "sponsor",
        body: `Stripe checkout session created for ${input.amountCents / 100} ${input.currency}. Complete checkout to finalize funding authorization.`,
        messageType: "PAYMENT",
      })

      await logMarketplaceAuditEvent({
        dealRoomId: input.dealRoomId,
        actorUserId: input.sponsorUserId,
        actorRole: "sponsor",
        action: "payment.checkout.created",
        entityType: "Transaction",
        entityId: (transaction as { id?: string }).id ?? null,
        details: {
          providerReference: authorization.providerReference,
          checkoutUrl: authorization.checkoutUrl,
        },
      })

      return transaction
    }

    await dealRoomService.update(input.dealRoomId, {
      status: "FUNDED",
      agreementStatus: "SIGNED",
    })

    await postDealRoomMessage({
      dealRoomId: input.dealRoomId,
      senderUserId: input.sponsorUserId,
      senderRole: "sponsor",
      body: `Funding authorized for ${input.amountCents / 100} ${input.currency}.`,
      messageType: "PAYMENT",
    })

    await notifyMarketplaceUser({
      recipientUserId: input.scientistUserId,
      recipientRole: "scientist",
      dealRoomId: input.dealRoomId,
      discoveryId: input.discoveryId,
      type: "payment-authorized",
      title: "Project funding authorized",
      body: `A sponsor has authorized ${input.amountCents / 100} ${input.currency} for your project.`,
      actionUrl: `/scientist-sponsor-marketplace?dealRoom=${input.dealRoomId}`,
      channels: ["in-app", "email"],
      status: "DELIVERED",
    })

    return transaction
  },

  async markMilestoneComplete(input: {
    dealRoomId: string
    transactionId: string
    actorUserId: string
  }) {
    const transaction = await transactionService.getById(input.transactionId)

    if (!transaction || transaction.dealRoomId !== input.dealRoomId) {
      throw new Error("Transaction not found for deal room")
    }

    return markMarketplaceMilestoneComplete({
      transactionId: input.transactionId,
      actorUserId: input.actorUserId,
    })
  },

  async approveAndRelease(input: {
    dealRoomId: string
    transactionId: string
    actorUserId: string
  }) {
    const transaction = await transactionService.getById(input.transactionId)

    if (!transaction || transaction.dealRoomId !== input.dealRoomId) {
      throw new Error("Transaction not found for deal room")
    }

    return approveAndReleaseMarketplaceTransaction({
      transactionId: input.transactionId,
      actorUserId: input.actorUserId,
    })
  },

  async rejectPayoutReview(input: {
    dealRoomId: string
    transactionId: string
    actorUserId: string
    rejection: unknown
  }) {
    const transaction = await transactionService.getById(input.transactionId)

    if (!transaction || transaction.dealRoomId !== input.dealRoomId) {
      throw new Error("Transaction not found for deal room")
    }

    return rejectMarketplaceTransactionReview({
      transactionId: input.transactionId,
      actorUserId: input.actorUserId,
      rejection: input.rejection,
    })
  },
}
