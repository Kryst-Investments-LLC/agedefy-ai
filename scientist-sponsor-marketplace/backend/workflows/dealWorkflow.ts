import { Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { buildLabPackage, generateSubmissionToken } from "@/lib/lab-package"
import { toJsonValue } from "@/scientist-sponsor-marketplace/backend/models/json"
import { billingService } from "@/scientist-sponsor-marketplace/backend/services/billingService"
import { dealRoomService } from "@/scientist-sponsor-marketplace/backend/services/dealRoomService"
import { postDealRoomMessage } from "@/scientist-sponsor-marketplace/backend/services/messageThreadService"
import { notifyMarketplaceUser } from "@/scientist-sponsor-marketplace/backend/services/notificationService"
import { transactionService } from "@/scientist-sponsor-marketplace/backend/services/transactionService"
import { logMarketplaceAuditEvent } from "@/scientist-sponsor-marketplace/backend/services/auditService"
import { approveAndReleaseMarketplaceTransaction, markMarketplaceMilestoneComplete, rejectMarketplaceTransactionReview } from "@/scientist-sponsor-marketplace/backend/services/paymentLifecycleService"
import type { MarketplaceRole } from "@/scientist-sponsor-marketplace/shared/types/entities"

async function createLabSubmissionForDeal(opts: {
  candidateId: string
  scientistUserId: string
  sponsorId: string
  dealRoomId: string
}): Promise<{ submissionId: string; token: string } | null> {
  const [candidate, sponsor] = await Promise.all([
    db.experimentCandidate.findUnique({ where: { id: opts.candidateId } }),
    db.marketplaceSponsor.findUnique({ where: { id: opts.sponsorId }, include: { user: true } }),
  ])

  if (!candidate) return null

  const labName = (sponsor as any)?.organizationName ?? "Marketplace Sponsor"
  const labContact = (sponsor as any)?.user?.email ?? null

  const requestedAssays = Array.isArray((candidate as any).metadata?.requestedAssays)
    ? ((candidate as any).metadata.requestedAssays as unknown[]).filter((a): a is string => typeof a === "string").map((name) => ({ assayName: name, replicates: 3 }))
    : [{ assayName: "standard_validation", replicates: 3 }]

  const { token, tokenHash } = generateSubmissionToken()

  const submission = await db.labSubmission.create({
    data: {
      candidateId: opts.candidateId,
      userId: opts.scientistUserId,
      labName,
      labContact,
      tokenHash,
      requestedAssays: toJsonValue(requestedAssays) as Prisma.InputJsonValue,
      packageJson: toJsonValue({ submission_ref: "pending" }) as Prisma.InputJsonValue,
    },
  })

  const pkg = buildLabPackage({
    submissionId: submission.id,
    candidate: {
      id: candidate.id,
      displayName: (candidate as any).displayName,
      kind: (candidate as any).kind,
      smiles: (candidate as any).smiles ?? null,
      chemblId: (candidate as any).chemblId ?? null,
      targetName: (candidate as any).targetName ?? null,
      targetChemblId: (candidate as any).targetChemblId ?? null,
      hypothesisNote: (candidate as any).hypothesisNote ?? null,
      screenJson: (candidate as any).screenJson as Record<string, unknown> | null,
      dockJson: (candidate as any).dockJson as Record<string, unknown> | null,
    },
    requestedAssays,
    labName,
    labContact,
    deadlineAt: null,
    ingestBaseUrl: process.env.NEXTAUTH_URL ?? "",
  })

  await db.labSubmission.update({
    where: { id: submission.id },
    data: { packageJson: toJsonValue(pkg) as Prisma.InputJsonValue },
  })

  if ((candidate as any).status === "SCREENED") {
    await db.experimentCandidate.update({
      where: { id: opts.candidateId },
      data: { status: "SENT_TO_LAB" },
    })
  }

  return { submissionId: submission.id, token }
}

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

    // If this deal is tied to a validation listing, auto-create a LabSubmission
    // so the scientist can hand off the candidate to the sponsor/lab immediately.
    const discovery = await db.marketplaceDiscovery.findUnique({ where: { id: input.discoveryId } })
    const candidateId = typeof (discovery?.metadata as Record<string, unknown>)?.candidateId === "string"
      ? ((discovery!.metadata as Record<string, unknown>).candidateId as string)
      : null

    let labSubmissionRef: { submissionId: string; token: string } | null = null
    if (candidateId) {
      labSubmissionRef = await createLabSubmissionForDeal({
        candidateId,
        scientistUserId: input.scientistUserId,
        sponsorId: input.sponsorId,
        dealRoomId: input.dealRoomId,
      })

      if (labSubmissionRef) {
        await postDealRoomMessage({
          dealRoomId: input.dealRoomId,
          senderUserId: null,
          senderRole: "admin",
          body: `Lab submission created (ref: ${labSubmissionRef.submissionId}). Provide token to the lab: ${labSubmissionRef.token}`,
          messageType: "SYSTEM",
        })
      }
    }

    await notifyMarketplaceUser({
      recipientUserId: input.scientistUserId,
      recipientRole: "scientist",
      dealRoomId: input.dealRoomId,
      discoveryId: input.discoveryId,
      type: "payment-authorized",
      title: "Project funding authorized",
      body: `A sponsor has authorized ${input.amountCents / 100} ${input.currency} for your project.${labSubmissionRef ? " Lab submission created — check deal room for ingest token." : ""}`,
      actionUrl: `/scientist-sponsor-marketplace?dealRoom=${input.dealRoomId}`,
      channels: ["in-app", "email"],
      status: "DELIVERED",
    })

    return { ...transaction, labSubmissionId: labSubmissionRef?.submissionId ?? null }
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
