import { db } from "@/lib/db"
import { notifyMarketplaceUser } from "@/scientist-sponsor-marketplace/backend/services/notificationService"
import { logMarketplaceAuditEvent } from "@/scientist-sponsor-marketplace/backend/services/auditService"
import { toJsonValue } from "@/scientist-sponsor-marketplace/backend/models/json"
import { postDealRoomMessage } from "@/scientist-sponsor-marketplace/backend/services/messageThreadService"
import { billingService } from "@/scientist-sponsor-marketplace/backend/services/billingService"
import { marketplacePayoutReviewRejectionSchema } from "@/scientist-sponsor-marketplace/shared/schemas/entities"

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

async function getMarketplaceTransactionWithRelations(transactionId: string) {
  return db.marketplaceTransaction.findUnique({
    where: { id: transactionId },
    include: {
      dealRoom: {
        include: {
          scientist: true,
          sponsor: true,
        },
      },
    },
  })
}

async function notifyMarketplaceAdmins(input: {
  dealRoomId: string
  discoveryId: string
  title: string
  body: string
  type: string
}) {
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  })

  await Promise.all(admins.map((admin) => notifyMarketplaceUser({
    recipientUserId: admin.id,
    recipientRole: "admin",
    dealRoomId: input.dealRoomId,
    discoveryId: input.discoveryId,
    type: input.type,
    title: input.title,
    body: input.body,
    actionUrl: `/scientist-sponsor-marketplace?dealRoom=${input.dealRoomId}`,
    channels: ["in-app", "email"],
    status: "DELIVERED",
  })))
}

export async function confirmMarketplaceStripeCheckoutSession(input: {
  checkoutSessionId: string
  paymentIntentId?: string | null
  source: "stripe-webhook" | "checkout-success"
}) {
  const providerReferences = [input.checkoutSessionId, input.paymentIntentId].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  )

  const transaction = await db.marketplaceTransaction.findFirst({
    where: {
      OR: providerReferences.map((providerReference) => ({ providerReference })),
    },
    include: {
      dealRoom: {
        include: {
          scientist: true,
          sponsor: true,
        },
      },
    },
  })

  if (!transaction) {
    return null
  }

  const confirmedAt = new Date()

  if (transaction.status === "PENDING") {
    const mergedMetadata = {
      ...asObject(transaction.metadata),
      stripeCheckoutSessionId: input.checkoutSessionId,
      stripePaymentIntentId: input.paymentIntentId ?? null,
      checkoutConfirmedAt: confirmedAt.toISOString(),
      checkoutConfirmedSource: input.source,
    }

    await db.marketplaceTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "AUTHORIZED",
        paidAt: confirmedAt,
        providerReference: input.paymentIntentId ?? transaction.providerReference,
        metadata: toJsonValue(mergedMetadata),
      },
    })

    await db.marketplaceDealRoom.update({
      where: { id: transaction.dealRoomId },
      data: {
        status: "FUNDED",
        agreementStatus: "SIGNED",
      },
    })

    await postDealRoomMessage({
      dealRoomId: transaction.dealRoomId,
      senderUserId: transaction.dealRoom.sponsor.userId,
      senderRole: "sponsor",
      body: `Funding authorized for ${transaction.amountCents / 100} ${transaction.currency}.`,
      messageType: "PAYMENT",
    })

    await notifyMarketplaceUser({
      recipientUserId: transaction.dealRoom.scientist.userId,
      recipientRole: "scientist",
      dealRoomId: transaction.dealRoomId,
      discoveryId: transaction.discoveryId,
      type: "payment-authorized",
      title: "Project funding authorized",
      body: `A sponsor has authorized ${transaction.amountCents / 100} ${transaction.currency} for your project.`,
      actionUrl: `/scientist-sponsor-marketplace?dealRoom=${transaction.dealRoomId}`,
      channels: ["in-app", "email"],
      status: "DELIVERED",
    })

    await logMarketplaceAuditEvent({
      dealRoomId: transaction.dealRoomId,
      actorUserId: transaction.dealRoom.sponsor.userId,
      actorRole: "sponsor",
      action: "payment.authorized",
      entityType: "Transaction",
      entityId: transaction.id,
      details: {
        checkoutSessionId: input.checkoutSessionId,
        paymentIntentId: input.paymentIntentId ?? null,
        source: input.source,
      },
    })
  }

  const updatedTransaction = await db.marketplaceTransaction.findUnique({
    where: { id: transaction.id },
  })

  return updatedTransaction
}

export async function markMarketplaceMilestoneComplete(input: {
  transactionId: string
  actorUserId: string
}) {
  const transaction = await getMarketplaceTransactionWithRelations(input.transactionId)

  if (!transaction) {
    return null
  }

  if (transaction.status !== "AUTHORIZED") {
    return transaction
  }

  const completedAt = new Date().toISOString()
  const mergedMetadata = {
    ...asObject(transaction.metadata),
    milestoneCompletion: {
      completedAt,
      completedBy: input.actorUserId,
    },
  }

  await db.marketplaceTransaction.update({
    where: { id: transaction.id },
    data: {
      status: "SETTLED",
      metadata: toJsonValue(mergedMetadata),
    },
  })

  await postDealRoomMessage({
    dealRoomId: transaction.dealRoomId,
    senderUserId: input.actorUserId,
    senderRole: "scientist",
    body: `Milestone marked complete for ${transaction.amountCents / 100} ${transaction.currency}. Admin review is now required before payout release.`,
    messageType: "PAYMENT",
  })

  await notifyMarketplaceAdmins({
    dealRoomId: transaction.dealRoomId,
    discoveryId: transaction.discoveryId,
    type: "payout-review-requested",
    title: "Marketplace payout is ready for review",
    body: `A scientist marked the funded milestone complete for ${transaction.amountCents / 100} ${transaction.currency}. Review and approve payout release.`,
  })

  await logMarketplaceAuditEvent({
    dealRoomId: transaction.dealRoomId,
    actorUserId: input.actorUserId,
    actorRole: "scientist",
    action: "payment.milestone.completed",
    entityType: "Transaction",
    entityId: transaction.id,
    details: {
      providerReference: transaction.providerReference,
      completedAt,
      reviewStatus: "SETTLED",
    },
  })

  return db.marketplaceTransaction.findUnique({
    where: { id: transaction.id },
  })
}

export async function approveAndReleaseMarketplaceTransaction(input: {
  transactionId: string
  actorUserId: string
}) {
  const transaction = await getMarketplaceTransactionWithRelations(input.transactionId)

  if (!transaction) {
    return null
  }

  if (transaction.status !== "SETTLED") {
    return transaction
  }

  const release = await billingService.releasePayout(String(transaction.providerReference ?? ""))
  const releasedAt = typeof release.releasedAt === "string" ? release.releasedAt : new Date().toISOString()
  const mergedMetadata = {
    ...asObject(transaction.metadata),
    payoutRelease: release,
    payoutReleasedAt: releasedAt,
    payoutReleasedBy: {
      userId: input.actorUserId,
      role: "admin",
    },
  }

  await db.marketplaceTransaction.update({
    where: { id: transaction.id },
    data: {
      status: release.status,
      metadata: toJsonValue(mergedMetadata),
    },
  })

  await postDealRoomMessage({
    dealRoomId: transaction.dealRoomId,
    senderUserId: input.actorUserId,
    senderRole: "admin",
    body: `Admin approved milestone review and released payout for ${transaction.amountCents / 100} ${transaction.currency}.`,
    messageType: "PAYMENT",
  })

  await notifyMarketplaceUser({
    recipientUserId: transaction.dealRoom.sponsor.userId,
    recipientRole: "sponsor",
    dealRoomId: transaction.dealRoomId,
    discoveryId: transaction.discoveryId,
    type: "payout-released",
    title: "Payout released for funded project",
    body: `Admin approved the completed milestone and released payout for ${transaction.amountCents / 100} ${transaction.currency}.`,
    actionUrl: `/scientist-sponsor-marketplace?dealRoom=${transaction.dealRoomId}`,
    channels: ["in-app", "email"],
    status: "DELIVERED",
  })

  await logMarketplaceAuditEvent({
    dealRoomId: transaction.dealRoomId,
    actorUserId: input.actorUserId,
    actorRole: "admin",
    action: "payment.approved_and_released",
    entityType: "Transaction",
    entityId: transaction.id,
    details: {
      providerReference: transaction.providerReference,
      releasedAt,
      releaseStatus: release.status,
    },
  })

  return db.marketplaceTransaction.findUnique({
    where: { id: transaction.id },
  })
}

export async function rejectMarketplaceTransactionReview(input: {
  transactionId: string
  actorUserId: string
  rejection: unknown
}) {
  const transaction = await getMarketplaceTransactionWithRelations(input.transactionId)

  if (!transaction) {
    return null
  }

  if (transaction.status !== "SETTLED") {
    return transaction
  }

  const reviewedAt = new Date().toISOString()
  const parsedRejection = marketplacePayoutReviewRejectionSchema.safeParse({
    ...(input.rejection && typeof input.rejection === "object" && !Array.isArray(input.rejection) ? input.rejection as Record<string, unknown> : {}),
    reviewedAt,
    reviewedBy: input.actorUserId,
  })

  if (!parsedRejection.success) {
    throw new Error("A valid structured rejection payload is required")
  }

  const rejection = parsedRejection.data
  const mergedMetadata = {
    ...asObject(transaction.metadata),
    payoutReview: {
      status: "REJECTED",
      ...rejection,
    },
  }

  await db.marketplaceTransaction.update({
    where: { id: transaction.id },
    data: {
      status: "AUTHORIZED",
      metadata: toJsonValue(mergedMetadata),
    },
  })

  await postDealRoomMessage({
    dealRoomId: transaction.dealRoomId,
    senderUserId: input.actorUserId,
    senderRole: "admin",
    body: `Admin rejected the payout review for ${transaction.amountCents / 100} ${transaction.currency}. Category: ${rejection.category}. Severity: ${rejection.blockerSeverity}. Follow-up: ${rejection.requiredFollowUpAction}. Summary: ${rejection.rejectionNote}`,
    messageType: "PAYMENT",
  })

  await notifyMarketplaceUser({
    recipientUserId: transaction.dealRoom.scientist.userId,
    recipientRole: "scientist",
    dealRoomId: transaction.dealRoomId,
    discoveryId: transaction.discoveryId,
    type: "payout-review-rejected",
    title: "Marketplace payout review was rejected",
    body: `Admin review rejected payout release for ${transaction.amountCents / 100} ${transaction.currency}. Category: ${rejection.category}. Severity: ${rejection.blockerSeverity}. Follow-up: ${rejection.requiredFollowUpAction}. Summary: ${rejection.rejectionNote}`,
    actionUrl: `/scientist-sponsor-marketplace?dealRoom=${transaction.dealRoomId}`,
    channels: ["in-app", "email"],
    status: "DELIVERED",
  })

  await notifyMarketplaceUser({
    recipientUserId: transaction.dealRoom.sponsor.userId,
    recipientRole: "sponsor",
    dealRoomId: transaction.dealRoomId,
    discoveryId: transaction.discoveryId,
    type: "payout-review-rejected",
    title: "Marketplace payout review was rejected",
    body: `Admin review rejected payout release for ${transaction.amountCents / 100} ${transaction.currency}. Category: ${rejection.category}. Severity: ${rejection.blockerSeverity}. Follow-up: ${rejection.requiredFollowUpAction}. Summary: ${rejection.rejectionNote}`,
    actionUrl: `/scientist-sponsor-marketplace?dealRoom=${transaction.dealRoomId}`,
    channels: ["in-app", "email"],
    status: "DELIVERED",
  })

  await logMarketplaceAuditEvent({
    dealRoomId: transaction.dealRoomId,
    actorUserId: input.actorUserId,
    actorRole: "admin",
    action: "payment.review.rejected",
    entityType: "Transaction",
    entityId: transaction.id,
    details: {
      providerReference: transaction.providerReference,
      reviewedAt,
      nextStatus: "AUTHORIZED",
      rejection,
    },
  })

  return db.marketplaceTransaction.findUnique({
    where: { id: transaction.id },
  })
}