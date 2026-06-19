import bcrypt from "bcryptjs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import { getTestJwtToken } from "@/__tests__/session-utils"

const testServerBaseUrl = process.env.TEST_SERVER_BASE_URL ?? "http://127.0.0.1:3101"
const seedSuffix = Date.now().toString()

const ownerUser = {
  email: `marketplace-owner-${seedSuffix}@example.com`,
  password: "TestPass123!",
  name: "Marketplace Owner",
}

const sponsorUser = {
  email: `marketplace-sponsor-${seedSuffix}@example.com`,
  password: "TestPass123!",
  name: "Marketplace Sponsor",
}

const outsiderUser = {
  email: `marketplace-outsider-${seedSuffix}@example.com`,
  password: "TestPass123!",
  name: "Marketplace Outsider",
}

const reviewerUser = {
  email: `marketplace-reviewer-${seedSuffix}@example.com`,
  password: "TestPass123!",
  name: "Marketplace Reviewer",
}

const adminUser = {
  email: `marketplace-admin-${seedSuffix}@example.com`,
  password: "TestPass123!",
  name: "Marketplace Admin",
}

let ownerToken: string
let sponsorToken: string
let outsiderToken: string
let reviewerToken: string
let adminToken: string
let ownerUserId: string
let sponsorUserId: string
let outsiderUserId: string
let reviewerUserId: string
let adminUserId: string
let ownerScientistId: string
let ownerSponsorId: string
let sponsorScientistId: string
let sponsorSponsorId: string
let outsiderScientistId: string
let outsiderSponsorId: string
let publishedDiscoveryId: string
let draftDiscoveryId: string
let requestMoreInfoDiscoveryId: string
let enterDealRoomDiscoveryId: string
let reviewerApprovalDiscoveryId: string
let adminApprovalDiscoveryId: string
let dealRoomId: string
let reviewerApprovalDealRoomId: string
let adminApprovalDealRoomId: string
let requestSequence = 0

function getAuthHeaders(token: string) {
  requestSequence += 1

  return {
    Authorization: `Bearer ${token}`,
    Cookie: `next-auth.session-token=${token}`,
    "idempotency-key": `marketplace-${seedSuffix}-${requestSequence}`,
  }
}

async function upsertUser(input: { email: string; password: string; name: string; role?: "MEMBER" | "ADMIN" | "CLINICIAN" | "RESEARCHER" }) {
  const passwordHash = await bcrypt.hash(input.password, 12)
  return db.user.upsert({
    where: { email: input.email.toLowerCase() },
    update: {
      name: input.name,
      passwordHash,
      ...(input.role ? { role: input.role } : {}),
    },
    create: {
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash,
      ...(input.role ? { role: input.role } : {}),
    },
  })
}

beforeAll(async () => {
  if (!process.env.TEST_SERVER_BASE_URL) return
  const [owner, sponsor, outsider, reviewer, admin] = await Promise.all([
    upsertUser(ownerUser),
    upsertUser(sponsorUser),
    upsertUser(outsiderUser),
    upsertUser({ ...reviewerUser, role: "RESEARCHER" }),
    upsertUser({ ...adminUser, role: "ADMIN" }),
  ])

  ownerUserId = owner.id
  sponsorUserId = sponsor.id
  outsiderUserId = outsider.id
  reviewerUserId = reviewer.id
  adminUserId = admin.id

  ownerToken = await getTestJwtToken(ownerUser)
  sponsorToken = await getTestJwtToken(sponsorUser)
  outsiderToken = await getTestJwtToken(outsiderUser)
  reviewerToken = await getTestJwtToken(reviewerUser)
  adminToken = await getTestJwtToken(adminUser)

  const [ownerScientist, ownerSponsor, sponsorScientist, sponsorSponsor, outsiderScientist, outsiderSponsor] = await Promise.all([
    db.marketplaceScientist.upsert({
      where: { userId: ownerUserId },
      update: {
        displayName: ownerUser.name,
        institution: "Biozephyra Lab",
        specialty: "Longevity Biology",
        categories: ["Longevity", "Diagnostics"],
      },
      create: {
        userId: ownerUserId,
        displayName: ownerUser.name,
        institution: "Biozephyra Lab",
        specialty: "Longevity Biology",
        categories: ["Longevity", "Diagnostics"],
      },
    }),
    db.marketplaceSponsor.upsert({
      where: { userId: ownerUserId },
      update: {
        organizationName: "Owner Ventures",
        thesis: "Owner investment thesis",
        preferredCategories: ["Longevity"],
        preferredStages: ["clinical"],
        geographyFocus: ["US"],
      },
      create: {
        userId: ownerUserId,
        organizationName: "Owner Ventures",
        thesis: "Owner investment thesis",
        preferredCategories: ["Longevity"],
        preferredStages: ["clinical"],
        geographyFocus: ["US"],
      },
    }),
    db.marketplaceScientist.upsert({
      where: { userId: sponsorUserId },
      update: {
        displayName: sponsorUser.name,
        institution: "Sponsor Labs",
        specialty: "Translational Science",
        categories: ["Therapeutics"],
      },
      create: {
        userId: sponsorUserId,
        displayName: sponsorUser.name,
        institution: "Sponsor Labs",
        specialty: "Translational Science",
        categories: ["Therapeutics"],
      },
    }),
    db.marketplaceSponsor.upsert({
      where: { userId: sponsorUserId },
      update: {
        organizationName: "Growth Capital",
        thesis: "Backing clinical longevity platforms",
        preferredCategories: ["Longevity", "Diagnostics"],
        preferredStages: ["clinical", "translational"],
        geographyFocus: ["US", "EU"],
      },
      create: {
        userId: sponsorUserId,
        organizationName: "Growth Capital",
        thesis: "Backing clinical longevity platforms",
        preferredCategories: ["Longevity", "Diagnostics"],
        preferredStages: ["clinical", "translational"],
        geographyFocus: ["US", "EU"],
      },
    }),
    db.marketplaceScientist.upsert({
      where: { userId: outsiderUserId },
      update: {
        displayName: outsiderUser.name,
        institution: "External Lab",
        specialty: "Bioinformatics",
        categories: ["Computational Biology"],
      },
      create: {
        userId: outsiderUserId,
        displayName: outsiderUser.name,
        institution: "External Lab",
        specialty: "Bioinformatics",
        categories: ["Computational Biology"],
      },
    }),
    db.marketplaceSponsor.upsert({
      where: { userId: outsiderUserId },
      update: {
        organizationName: "Outsider Capital",
        thesis: "External diligence",
        preferredCategories: ["Computational Biology"],
        preferredStages: ["platform"],
        geographyFocus: ["APAC"],
      },
      create: {
        userId: outsiderUserId,
        organizationName: "Outsider Capital",
        thesis: "External diligence",
        preferredCategories: ["Computational Biology"],
        preferredStages: ["platform"],
        geographyFocus: ["APAC"],
      },
    }),
  ])

  ownerScientistId = ownerScientist.id
  ownerSponsorId = ownerSponsor.id
  sponsorScientistId = sponsorScientist.id
  sponsorSponsorId = sponsorSponsor.id
  outsiderScientistId = outsiderScientist.id
  outsiderSponsorId = outsiderSponsor.id

  const publishedDiscovery = await db.marketplaceDiscovery.create({
    data: {
      scientistId: ownerScientistId,
      title: `Clinical Senolytic Program ${seedSuffix}`,
      slug: `clinical-senolytic-program-${seedSuffix}`,
      category: "Longevity",
      summary: "A published clinical discovery for sponsor diligence and matching.",
      developmentStage: "clinical",
      status: "PUBLISHED",
      scientificImpactScore: 0.91,
      commercialReadiness: 0.74,
      fundingGoalCents: 250000,
      currency: "USD",
      evidenceSummary: "Peer-reviewed evidence package",
      evidenceLinks: [{ label: "Paper", url: "https://example.com/paper" }],
      metadata: { cohort: "older adults" },
      publishedAt: new Date(),
    },
  })

  const draftDiscovery = await db.marketplaceDiscovery.create({
    data: {
      scientistId: ownerScientistId,
      title: `Private Diagnostics Program ${seedSuffix}`,
      slug: `private-diagnostics-program-${seedSuffix}`,
      category: "Diagnostics",
      summary: "A draft discovery that should remain hidden from sponsor list views.",
      developmentStage: "translational",
      status: "DRAFT",
      scientificImpactScore: 0.67,
      commercialReadiness: 0.4,
      fundingGoalCents: 125000,
      currency: "USD",
      evidenceLinks: [],
      metadata: { assay: "prototype" },
    },
  })

  publishedDiscoveryId = publishedDiscovery.id
  draftDiscoveryId = draftDiscovery.id

  const requestMoreInfoDiscovery = await db.marketplaceDiscovery.create({
    data: {
      scientistId: ownerScientistId,
      title: `Diligence Ready Longevity Program ${seedSuffix}`,
      slug: `diligence-ready-longevity-program-${seedSuffix}`,
      category: "Longevity",
      summary: "A published discovery used to validate requestMoreInfo transitions.",
      developmentStage: "translational",
      status: "PUBLISHED",
      scientificImpactScore: 0.83,
      commercialReadiness: 0.59,
      fundingGoalCents: 180000,
      currency: "USD",
      evidenceLinks: [{ label: "Deck", url: "https://example.com/deck" }],
      metadata: { transition: "requestMoreInfo" },
      publishedAt: new Date(),
    },
  })

  const enterDealRoomDiscovery = await db.marketplaceDiscovery.create({
    data: {
      scientistId: ownerScientistId,
      title: `Open Collaboration Program ${seedSuffix}`,
      slug: `open-collaboration-program-${seedSuffix}`,
      category: "Diagnostics",
      summary: "A published discovery used to validate enterDealRoom transitions.",
      developmentStage: "clinical",
      status: "PUBLISHED",
      scientificImpactScore: 0.79,
      commercialReadiness: 0.63,
      fundingGoalCents: 190000,
      currency: "USD",
      evidenceLinks: [{ label: "Brief", url: "https://example.com/brief" }],
      metadata: { transition: "enterDealRoom" },
      publishedAt: new Date(),
    },
  })

  requestMoreInfoDiscoveryId = requestMoreInfoDiscovery.id
  enterDealRoomDiscoveryId = enterDealRoomDiscovery.id

  const reviewerApprovalDiscovery = await db.marketplaceDiscovery.create({
    data: {
      scientistId: ownerScientistId,
      title: `Reviewer Approval Program ${seedSuffix}`,
      slug: `reviewer-approval-program-${seedSuffix}`,
      category: "Longevity",
      summary: "A published discovery used to validate reviewer agreement approval.",
      developmentStage: "clinical",
      status: "PUBLISHED",
      scientificImpactScore: 0.82,
      commercialReadiness: 0.66,
      fundingGoalCents: 205000,
      currency: "USD",
      evidenceLinks: [{ label: "Memo", url: "https://example.com/memo" }],
      metadata: { transition: "reviewerApproval" },
      publishedAt: new Date(),
    },
  })

  const adminApprovalDiscovery = await db.marketplaceDiscovery.create({
    data: {
      scientistId: ownerScientistId,
      title: `Admin Approval Program ${seedSuffix}`,
      slug: `admin-approval-program-${seedSuffix}`,
      category: "Diagnostics",
      summary: "A published discovery used to validate admin agreement approval.",
      developmentStage: "translational",
      status: "PUBLISHED",
      scientificImpactScore: 0.8,
      commercialReadiness: 0.61,
      fundingGoalCents: 215000,
      currency: "USD",
      evidenceLinks: [{ label: "Briefing", url: "https://example.com/briefing" }],
      metadata: { transition: "adminApproval" },
      publishedAt: new Date(),
    },
  })

  reviewerApprovalDiscoveryId = reviewerApprovalDiscovery.id
  adminApprovalDiscoveryId = adminApprovalDiscovery.id

  await db.marketplaceFundingRequest.create({
    data: {
      discoveryId: publishedDiscoveryId,
      scientistId: ownerScientistId,
      requestedAmountCents: 240000,
      currency: "USD",
      useOfFunds: "Expand the clinical validation cohort and biomarker monitoring.",
      timelineMonths: 18,
      status: "OPEN",
      milestonePlan: [
        { milestone: "Pilot expansion", targetDate: "2026-09-01", deliverable: "60 patient cohort" },
      ],
      evidenceUploads: [
        { name: "protocol.pdf", url: "https://example.com/protocol.pdf", kind: "protocol" },
      ],
      publishedAt: new Date(),
    },
  })

  const dealRoom = await db.marketplaceDealRoom.create({
    data: {
      discoveryId: publishedDiscoveryId,
      scientistId: ownerScientistId,
      sponsorId: sponsorSponsorId,
      status: "OPEN",
      agreementStatus: "DRAFT",
      agreementTerms: { exclusivityDays: 30 },
      documentVault: [{ name: "diligence.zip", url: "https://example.com/diligence.zip" }],
    },
  })
  dealRoomId = dealRoom.id

  const reviewerApprovalDealRoom = await db.marketplaceDealRoom.create({
    data: {
      discoveryId: reviewerApprovalDiscoveryId,
      scientistId: ownerScientistId,
      sponsorId: sponsorSponsorId,
      status: "AGREEMENT_PENDING",
      agreementStatus: "REVIEW",
      agreementTerms: { exclusivityDays: 45, approvalPath: "reviewer" },
      documentVault: [],
    },
  })
  reviewerApprovalDealRoomId = reviewerApprovalDealRoom.id

  const adminApprovalDealRoom = await db.marketplaceDealRoom.create({
    data: {
      discoveryId: adminApprovalDiscoveryId,
      scientistId: ownerScientistId,
      sponsorId: sponsorSponsorId,
      status: "AGREEMENT_PENDING",
      agreementStatus: "REVIEW",
      agreementTerms: { exclusivityDays: 60, approvalPath: "admin" },
      documentVault: [],
    },
  })
  adminApprovalDealRoomId = adminApprovalDealRoom.id

  await Promise.all([
    db.marketplaceMessageThread.create({
      data: {
        dealRoomId,
        senderUserId: sponsorUserId,
        senderRole: "sponsor",
        body: "We want to review the diligence package.",
        attachments: [],
      },
    }),
    db.marketplaceTransaction.create({
      data: {
        dealRoomId,
        discoveryId: publishedDiscoveryId,
        sponsorId: sponsorSponsorId,
        amountCents: 210000,
        currency: "USD",
        platformFeeCents: 10500,
        transactionFeeCents: 5250,
        payoutCents: 194250,
        status: "AUTHORIZED",
        metadata: { subscriptionTier: "growth" },
      },
    }),
    db.marketplaceNotification.create({
      data: {
        recipientUserId: ownerUserId,
        recipientRole: "scientist",
        discoveryId: publishedDiscoveryId,
        dealRoomId,
        type: "deal-room.message",
        title: "Sponsor requested diligence",
        body: "A sponsor opened a diligence thread for your discovery.",
        channels: ["in-app"],
        status: "QUEUED",
      },
    }),
    db.marketplaceAuditLog.create({
      data: {
        dealRoomId,
        actorUserId: sponsorUserId,
        actorRole: "sponsor",
        action: "deal-room.opened",
        entityType: "MarketplaceDealRoom",
        entityId: dealRoomId,
        details: { seeded: true },
      },
    }),
    db.marketplaceAuditLog.create({
      data: {
        actorUserId: outsiderUserId,
        actorRole: "scientist",
        action: "outsider.audit",
        entityType: "MarketplaceDiscovery",
        entityId: draftDiscoveryId,
        details: { seeded: true, unrelated: true },
      },
    }),
  ])

})

afterAll(async () => {
  await db.user.deleteMany({
    where: {
      email: {
        in: [
          ownerUser.email.toLowerCase(),
          sponsorUser.email.toLowerCase(),
          outsiderUser.email.toLowerCase(),
          reviewerUser.email.toLowerCase(),
          adminUser.email.toLowerCase(),
        ],
      },
    },
  })
})

describe.skipIf(!process.env.TEST_SERVER_BASE_URL)("live marketplace API integration", () => {
  it("returns a seeded workspace snapshot for the owner scientist", async () => {
    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workspace?actingAsRole=scientist`, {
      headers: getAuthHeaders(ownerToken),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload.actor.actingAs).toBe("scientist")
    expect(payload.scientist.id).toBe(ownerScientistId)
    expect(payload.sponsor.id).toBe(ownerSponsorId)
    const discoveryIds = payload.discoveries.map((item: { id: string }) => item.id)
    expect(discoveryIds).toEqual(
      expect.arrayContaining([
        publishedDiscoveryId,
        draftDiscoveryId,
        requestMoreInfoDiscoveryId,
        enterDealRoomDiscoveryId,
        reviewerApprovalDiscoveryId,
        adminApprovalDiscoveryId,
      ]),
    )
    expect(payload.fundingRequests).toHaveLength(1)
    expect(payload.dealRooms).toHaveLength(3)
    expect(payload.dealRooms.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([dealRoomId, reviewerApprovalDealRoomId, adminApprovalDealRoomId]),
    )
    expect(payload.messages).toHaveLength(1)
    expect(payload.transactions).toHaveLength(1)
    expect(payload.notifications).toHaveLength(1)
    expect(payload.metrics.publishedDiscoveries).toBe(5)
    expect(payload.metrics.openDealRooms).toBe(3)
    expect(payload.metrics.fundedVolumeCents).toBe(210000)
    expect(payload.metrics.unreadNotifications).toBe(1)
    expect(payload.audits).toHaveLength(1)
    expect(payload.audits[0].entityId).toBe(dealRoomId)
  })

  it("returns only published discoveries to a sponsor list request", async () => {
    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/discoveries?actingAsRole=sponsor`, {
      headers: getAuthHeaders(sponsorToken),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    const recordIds = payload.records.map((record: { id: string }) => record.id)

    expect(payload.entity).toBe("Discovery")
    expect(payload.actingAs).toBe("sponsor")
    expect(recordIds).toContain(publishedDiscoveryId)
    expect(recordIds).not.toContain(draftDiscoveryId)
  })

  it("creates a deal room and diligence side effects through requestMoreInfo", async () => {
    const message = `Please share diligence materials ${seedSuffix}`
    const beforeDealRoomCount = await db.marketplaceDealRoom.count({
      where: { discoveryId: requestMoreInfoDiscoveryId, sponsorId: sponsorSponsorId },
    })
    const beforeNotificationCount = await db.marketplaceNotification.count({
      where: { recipientUserId: ownerUserId, discoveryId: requestMoreInfoDiscoveryId },
    })

    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/sponsor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(sponsorToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "requestMoreInfo",
        discoveryId: requestMoreInfoDiscoveryId,
        message,
      }),
    })

    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.discoveryId).toBe(requestMoreInfoDiscoveryId)
    expect(payload.sponsorId).toBe(sponsorSponsorId)
    expect(payload.scientistId).toBe(ownerScientistId)
    expect(payload.status).toBe("OPEN")

    const afterDealRoomCount = await db.marketplaceDealRoom.count({
      where: { discoveryId: requestMoreInfoDiscoveryId, sponsorId: sponsorSponsorId },
    })
    expect(afterDealRoomCount).toBe(beforeDealRoomCount + 1)

    const persistedMessage = await db.marketplaceMessageThread.findFirst({
      where: {
        dealRoomId: payload.id,
        senderUserId: sponsorUserId,
        senderRole: "sponsor",
      },
      orderBy: { createdAt: "desc" },
    })
    expect(persistedMessage?.body).toBe(message)
    expect(persistedMessage?.messageType).toBe("MESSAGE")

    const afterNotificationCount = await db.marketplaceNotification.count({
      where: { recipientUserId: ownerUserId, discoveryId: requestMoreInfoDiscoveryId },
    })
    expect(afterNotificationCount).toBe(beforeNotificationCount + 1)

    const persistedNotification = await db.marketplaceNotification.findFirst({
      where: {
        recipientUserId: ownerUserId,
        discoveryId: requestMoreInfoDiscoveryId,
      },
      orderBy: { createdAt: "desc" },
    })
    expect(persistedNotification?.type).toBe("request-more-info")
    expect(persistedNotification?.dealRoomId).toBe(payload.id)
    expect(persistedNotification?.body).toBe(message)
  })

  it("creates a pre-funding deal room through enterDealRoom", async () => {
    const beforeDealRoomCount = await db.marketplaceDealRoom.count({
      where: { discoveryId: enterDealRoomDiscoveryId, sponsorId: sponsorSponsorId },
    })

    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/sponsor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(sponsorToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "enterDealRoom",
        discoveryId: enterDealRoomDiscoveryId,
      }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.discoveryId).toBe(enterDealRoomDiscoveryId)
    expect(payload.sponsorId).toBe(sponsorSponsorId)
    expect(payload.scientistId).toBe(ownerScientistId)
    expect(payload.status).toBe("OPEN")
    expect(payload.agreementStatus).toBe("DRAFT")

    const afterDealRoomCount = await db.marketplaceDealRoom.count({
      where: { discoveryId: enterDealRoomDiscoveryId, sponsorId: sponsorSponsorId },
    })
    expect(afterDealRoomCount).toBe(beforeDealRoomCount + 1)

    const persistedMessages = await db.marketplaceMessageThread.count({
      where: { dealRoomId: payload.id },
    })
    expect(persistedMessages).toBe(0)
  })

  it("returns 403 when a non-member sponsor requests more info for a non-readable discovery", async () => {
    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/sponsor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(outsiderToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "requestMoreInfo",
        discoveryId: draftDiscoveryId,
        message: `Unauthorized diligence request ${seedSuffix}`,
      }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
  })

  it("returns 403 when a non-member sponsor enters a deal room for a non-readable discovery", async () => {
    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/sponsor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(outsiderToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "enterDealRoom",
        discoveryId: draftDiscoveryId,
      }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
  })

  it("persists a sponsor deal-room message through the live workflow API", async () => {
    const messageBody = `Please share the updated PK dataset ${seedSuffix}`
    const beforeCount = await db.marketplaceMessageThread.count({ where: { dealRoomId } })

    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(sponsorToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "message",
        dealRoomId,
        body: messageBody,
      }),
    })

    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.dealRoomId).toBe(dealRoomId)
    expect(payload.senderRole).toBe("sponsor")
    expect(payload.body).toBe(messageBody)
    expect(payload.messageType).toBe("MESSAGE")

    const afterCount = await db.marketplaceMessageThread.count({ where: { dealRoomId } })
    expect(afterCount).toBe(beforeCount + 1)

    const persisted = await db.marketplaceMessageThread.findUnique({ where: { id: payload.id } })
    expect(persisted?.senderUserId).toBe(sponsorUserId)
    expect(persisted?.body).toBe(messageBody)
  })

  it("persists sponsor funding workflow side effects through the live API", async () => {
    const amountCents = 300000
    const beforePaymentNotificationCount = await db.marketplaceNotification.count({
      where: {
        recipientUserId: ownerUserId,
        type: "payment-authorized",
        dealRoomId,
      },
    })

    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/sponsor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(sponsorToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "fund",
        dealRoomId,
        amountCents,
        currency: "USD",
        subscriptionTier: "growth",
      }),
    })

    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.dealRoomId).toBe(dealRoomId)
    expect(payload.discoveryId).toBe(publishedDiscoveryId)
    expect(payload.sponsorId).toBe(sponsorSponsorId)
    expect(payload.amountCents).toBe(amountCents)
    expect(payload.status).toBe("AUTHORIZED")
    expect(payload.platformFeeCents).toBe(21000)
    expect(payload.transactionFeeCents).toBe(5250)
    expect(payload.payoutCents).toBe(273750)
    expect(String(payload.providerReference)).toContain("escrow_usd_300000")

    const updatedDealRoom = await db.marketplaceDealRoom.findUnique({ where: { id: dealRoomId } })
    expect(updatedDealRoom?.status).toBe("FUNDED")
    expect(updatedDealRoom?.agreementStatus).toBe("SIGNED")

    const paymentMessage = await db.marketplaceMessageThread.findFirst({
      where: {
        dealRoomId,
        messageType: "PAYMENT",
        senderUserId: sponsorUserId,
      },
      orderBy: { createdAt: "desc" },
    })
    expect(paymentMessage?.body).toContain("Funding authorized")

    const ownerNotifications = await db.marketplaceNotification.findMany({
      where: { recipientUserId: ownerUserId, type: "payment-authorized", dealRoomId },
      orderBy: { createdAt: "desc" },
    })
    expect(ownerNotifications.length).toBe(beforePaymentNotificationCount + 1)
    expect(ownerNotifications[0].type).toBe("payment-authorized")
    expect(ownerNotifications[0].dealRoomId).toBe(dealRoomId)
    expect(ownerNotifications[0].status).toBe("DELIVERED")
  })

  it("routes payout through scientist completion and admin approval before release", async () => {
    const fundResponse = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/sponsor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(sponsorToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "fund",
        dealRoomId,
        amountCents: 180000,
        currency: "USD",
        subscriptionTier: "growth",
      }),
    })

    expect(fundResponse.status).toBe(201)
    const fundedTransaction = await fundResponse.json()
    expect(fundedTransaction.status).toBe("AUTHORIZED")

    const beforeAdminReviewNotifications = await db.marketplaceNotification.count({
      where: {
        recipientUserId: adminUserId,
        type: "payout-review-requested",
        dealRoomId,
      },
    })

    const beforeSponsorReleaseNotifications = await db.marketplaceNotification.count({
      where: {
        recipientUserId: sponsorUserId,
        type: "payout-released",
        dealRoomId,
      },
    })

    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(ownerToken),
      },
      body: JSON.stringify({
        actingAsRole: "scientist",
        action: "markMilestoneComplete",
        dealRoomId,
        transactionId: fundedTransaction.id,
      }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.id).toBe(fundedTransaction.id)
    expect(payload.status).toBe("SETTLED")

    const updatedTransaction = await db.marketplaceTransaction.findUnique({ where: { id: fundedTransaction.id } })
    expect(updatedTransaction?.status).toBe("SETTLED")

    const paymentMessage = await db.marketplaceMessageThread.findFirst({
      where: {
        dealRoomId,
        messageType: "PAYMENT",
        senderUserId: ownerUserId,
      },
      orderBy: { createdAt: "desc" },
    })
    expect(paymentMessage?.body).toContain("Admin review is now required")

    const adminReviewNotifications = await db.marketplaceNotification.findMany({
      where: { recipientUserId: adminUserId, type: "payout-review-requested", dealRoomId },
      orderBy: { createdAt: "desc" },
    })
    expect(adminReviewNotifications.length).toBe(beforeAdminReviewNotifications + 1)
    expect(adminReviewNotifications[0].status).toBe("DELIVERED")

    const adminResponse = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(adminToken),
      },
      body: JSON.stringify({
        actingAsRole: "admin",
        action: "approveAndRelease",
        dealRoomId,
        transactionId: fundedTransaction.id,
      }),
    })

    expect(adminResponse.status).toBe(200)
    const adminPayload = await adminResponse.json()
    expect(adminPayload.id).toBe(fundedTransaction.id)
    expect(adminPayload.status).toBe("RELEASED")

    const releasedTransaction = await db.marketplaceTransaction.findUnique({ where: { id: fundedTransaction.id } })
    expect(releasedTransaction?.status).toBe("RELEASED")

    const adminPaymentMessage = await db.marketplaceMessageThread.findFirst({
      where: {
        dealRoomId,
        messageType: "PAYMENT",
        senderUserId: adminUserId,
      },
      orderBy: { createdAt: "desc" },
    })
    expect(adminPaymentMessage?.body).toContain("released payout")

    const sponsorNotifications = await db.marketplaceNotification.findMany({
      where: { recipientUserId: sponsorUserId, type: "payout-released", dealRoomId },
      orderBy: { createdAt: "desc" },
    })
    expect(sponsorNotifications.length).toBe(beforeSponsorReleaseNotifications + 1)
    expect(sponsorNotifications[0].status).toBe("DELIVERED")
  })

  it("returns a settled payout to authorized state when admin rejects review", async () => {
    const rejection = {
      category: "evidence_gap",
      blockerSeverity: "high",
      rejectionNote: `Milestone evidence package is missing assay validation details ${seedSuffix}`,
      requiredFollowUpAction: `Upload assay validation appendix and replicate cohort summary ${seedSuffix}`,
    } as const
    const fundResponse = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/sponsor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(sponsorToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "fund",
        dealRoomId,
        amountCents: 190000,
        currency: "USD",
        subscriptionTier: "growth",
      }),
    })

    expect(fundResponse.status).toBe(201)
    const fundedTransaction = await fundResponse.json()
    expect(fundedTransaction.status).toBe("AUTHORIZED")

    const markResponse = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(ownerToken),
      },
      body: JSON.stringify({
        actingAsRole: "scientist",
        action: "markMilestoneComplete",
        dealRoomId,
        transactionId: fundedTransaction.id,
      }),
    })

    expect(markResponse.status).toBe(200)
    await expect(markResponse.json()).resolves.toEqual(expect.objectContaining({ status: "SETTLED" }))

    const beforeScientistRejectedNotifications = await db.marketplaceNotification.count({
      where: {
        recipientUserId: ownerUserId,
        type: "payout-review-rejected",
        dealRoomId,
      },
    })

    const beforeSponsorRejectedNotifications = await db.marketplaceNotification.count({
      where: {
        recipientUserId: sponsorUserId,
        type: "payout-review-rejected",
        dealRoomId,
      },
    })

    const rejectResponse = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(adminToken),
      },
      body: JSON.stringify({
        actingAsRole: "admin",
        action: "rejectPayoutReview",
        dealRoomId,
        transactionId: fundedTransaction.id,
        rejection,
      }),
    })

    expect(rejectResponse.status).toBe(200)
    const payload = await rejectResponse.json()
    expect(payload.id).toBe(fundedTransaction.id)
    expect(payload.status).toBe("AUTHORIZED")

    const updatedTransaction = await db.marketplaceTransaction.findUnique({ where: { id: fundedTransaction.id } })
    expect(updatedTransaction?.status).toBe("AUTHORIZED")
    expect(updatedTransaction?.metadata).toEqual(expect.objectContaining({
      payoutReview: expect.objectContaining({
        category: rejection.category,
        blockerSeverity: rejection.blockerSeverity,
        rejectionNote: rejection.rejectionNote,
        requiredFollowUpAction: rejection.requiredFollowUpAction,
      }),
    }))

    const adminPaymentMessage = await db.marketplaceMessageThread.findFirst({
      where: {
        dealRoomId,
        messageType: "PAYMENT",
        senderUserId: adminUserId,
      },
      orderBy: { createdAt: "desc" },
    })
    expect(adminPaymentMessage?.body).toContain("rejected the payout review")
    expect(adminPaymentMessage?.body).toContain(rejection.rejectionNote)
    expect(adminPaymentMessage?.body).toContain(rejection.requiredFollowUpAction)

    const scientistRejectedNotifications = await db.marketplaceNotification.findMany({
      where: { recipientUserId: ownerUserId, type: "payout-review-rejected", dealRoomId },
      orderBy: { createdAt: "desc" },
    })
    expect(scientistRejectedNotifications.length).toBe(beforeScientistRejectedNotifications + 1)
    expect(scientistRejectedNotifications[0].status).toBe("DELIVERED")
    expect(scientistRejectedNotifications[0].body).toContain(rejection.rejectionNote)
    expect(scientistRejectedNotifications[0].body).toContain(rejection.requiredFollowUpAction)

    const sponsorRejectedNotifications = await db.marketplaceNotification.findMany({
      where: { recipientUserId: sponsorUserId, type: "payout-review-rejected", dealRoomId },
      orderBy: { createdAt: "desc" },
    })
    expect(sponsorRejectedNotifications.length).toBe(beforeSponsorRejectedNotifications + 1)
    expect(sponsorRejectedNotifications[0].status).toBe("DELIVERED")
    expect(sponsorRejectedNotifications[0].body).toContain(rejection.rejectionNote)
    expect(sponsorRejectedNotifications[0].body).toContain(rejection.requiredFollowUpAction)
  })

  it("returns 403 when a non-member sponsor attempts to message another deal room", async () => {
    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(outsiderToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "message",
        dealRoomId,
        body: `Unauthorized message ${seedSuffix}`,
      }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
  })

  it("returns 403 when a non-member sponsor attempts to fund another deal room", async () => {
    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/sponsor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(outsiderToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "fund",
        dealRoomId,
        amountCents: 150000,
        currency: "USD",
        subscriptionTier: "growth",
      }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
  })

  it("returns 403 when a non-member sponsor attempts to negotiate another deal room", async () => {
    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(outsiderToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "negotiate",
        dealRoomId,
        termsPatch: { exclusivityDays: 90 },
      }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
  })

  it("returns 403 when a non-member sponsor attempts to build an agreement for another deal room", async () => {
    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(outsiderToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "buildAgreement",
        dealRoomId,
        agreementTerms: { valuationCap: 1500000 },
      }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
  })

  it("persists a sponsor buildAgreement mutation through the live workflow API", async () => {
    const agreementTerms = {
      exclusivityDays: 75,
      valuationCap: 2200000,
      governingLaw: "Delaware",
    }
    const beforeAuditCount = await db.marketplaceAuditLog.count({
      where: {
        dealRoomId: reviewerApprovalDealRoomId,
        actorUserId: sponsorUserId,
        action: "agreement.built",
      },
    })

    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(sponsorToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "buildAgreement",
        dealRoomId: reviewerApprovalDealRoomId,
        agreementTerms,
      }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.id).toBe(reviewerApprovalDealRoomId)
    expect(payload.status).toBe("AGREEMENT_PENDING")
    expect(payload.agreementStatus).toBe("REVIEW")
    expect(payload.agreementTerms).toMatchObject(agreementTerms)

    const updated = await db.marketplaceDealRoom.findUnique({ where: { id: reviewerApprovalDealRoomId } })
    expect(updated?.status).toBe("AGREEMENT_PENDING")
    expect(updated?.agreementStatus).toBe("REVIEW")
    expect(updated?.agreementTerms).toMatchObject(agreementTerms)

    const buildAudits = await db.marketplaceAuditLog.findMany({
      where: {
        dealRoomId: reviewerApprovalDealRoomId,
        actorUserId: sponsorUserId,
        action: "agreement.built",
      },
      orderBy: { createdAt: "desc" },
    })
    expect(buildAudits.length).toBe(beforeAuditCount + 1)
    expect((buildAudits[0].details as { keys?: string[] }).keys).toEqual(expect.arrayContaining(["exclusivityDays", "valuationCap", "governingLaw"]))
  })

  it("persists a sponsor negotiate mutation through the live workflow API", async () => {
    const termsPatch = {
      boardObserverSeat: true,
      diligenceWindowDays: 21,
    }
    const beforeAuditCount = await db.marketplaceAuditLog.count({
      where: {
        dealRoomId: adminApprovalDealRoomId,
        actorUserId: sponsorUserId,
        action: "deal.negotiated",
      },
    })

    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(sponsorToken),
      },
      body: JSON.stringify({
        actingAsRole: "sponsor",
        action: "negotiate",
        dealRoomId: adminApprovalDealRoomId,
        termsPatch,
      }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.id).toBe(adminApprovalDealRoomId)
    expect(payload.status).toBe("NEGOTIATING")
    expect(payload.agreementTerms).toMatchObject({
      exclusivityDays: 60,
      approvalPath: "admin",
      ...termsPatch,
    })

    const updated = await db.marketplaceDealRoom.findUnique({ where: { id: adminApprovalDealRoomId } })
    expect(updated?.status).toBe("NEGOTIATING")
    expect(updated?.agreementTerms).toMatchObject({
      exclusivityDays: 60,
      approvalPath: "admin",
      ...termsPatch,
    })

    const negotiateAudits = await db.marketplaceAuditLog.findMany({
      where: {
        dealRoomId: adminApprovalDealRoomId,
        actorUserId: sponsorUserId,
        action: "deal.negotiated",
      },
      orderBy: { createdAt: "desc" },
    })
    expect(negotiateAudits.length).toBe(beforeAuditCount + 1)
    expect(negotiateAudits[0].details).toMatchObject(termsPatch)
  })

  it("allows a reviewer to approve an agreement through the live API", async () => {
    const beforeAuditCount = await db.marketplaceAuditLog.count({
      where: {
        dealRoomId: reviewerApprovalDealRoomId,
        actorUserId: reviewerUserId,
        action: "agreement.approved",
      },
    })

    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(reviewerToken),
      },
      body: JSON.stringify({
        actingAsRole: "reviewer",
        action: "approveAgreement",
        dealRoomId: reviewerApprovalDealRoomId,
        approvalNote: `Reviewer approval ${seedSuffix}`,
      }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.id).toBe(reviewerApprovalDealRoomId)
    expect(payload.agreementStatus).toBe("APPROVED")

    const updated = await db.marketplaceDealRoom.findUnique({ where: { id: reviewerApprovalDealRoomId } })
    expect(updated?.agreementStatus).toBe("APPROVED")

    const reviewerAudits = await db.marketplaceAuditLog.findMany({
      where: {
        dealRoomId: reviewerApprovalDealRoomId,
        actorUserId: reviewerUserId,
        action: "agreement.approved",
      },
      orderBy: { createdAt: "desc" },
    })
    expect(reviewerAudits.length).toBe(beforeAuditCount + 1)
    expect(reviewerAudits[0].actorRole).toBe("reviewer")
    expect(reviewerAudits[0].entityType).toBe("DealRoom")
    expect(reviewerAudits[0].entityId).toBe(reviewerApprovalDealRoomId)
    expect((reviewerAudits[0].details as { approvalNote?: string }).approvalNote).toBe(`Reviewer approval ${seedSuffix}`)

    const reviewerWorkspaceResponse = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workspace?actingAsRole=reviewer`, {
      headers: getAuthHeaders(reviewerToken),
    })
    expect(reviewerWorkspaceResponse.status).toBe(200)

    const reviewerWorkspace = await reviewerWorkspaceResponse.json()
    expect(
      reviewerWorkspace.audits.some(
        (audit: { dealRoomId: string | null; actorUserId: string | null; action: string; entityId: string | null; details: { approvalNote?: string } }) =>
          audit.dealRoomId === reviewerApprovalDealRoomId &&
          audit.actorUserId === reviewerUserId &&
          audit.action === "agreement.approved" &&
          audit.entityId === reviewerApprovalDealRoomId &&
          audit.details.approvalNote === `Reviewer approval ${seedSuffix}`,
      ),
    ).toBe(true)
  })

  it("allows an admin to approve an agreement through the live API", async () => {
    const beforeAuditCount = await db.marketplaceAuditLog.count({
      where: {
        dealRoomId: adminApprovalDealRoomId,
        actorUserId: adminUserId,
        action: "agreement.approved",
      },
    })

    const response = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(adminToken),
      },
      body: JSON.stringify({
        actingAsRole: "admin",
        action: "approveAgreement",
        dealRoomId: adminApprovalDealRoomId,
        approvalNote: `Admin approval ${seedSuffix}`,
      }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.id).toBe(adminApprovalDealRoomId)
    expect(payload.agreementStatus).toBe("APPROVED")

    const updated = await db.marketplaceDealRoom.findUnique({ where: { id: adminApprovalDealRoomId } })
    expect(updated?.agreementStatus).toBe("APPROVED")

    const adminAudits = await db.marketplaceAuditLog.findMany({
      where: {
        dealRoomId: adminApprovalDealRoomId,
        actorUserId: adminUserId,
        action: "agreement.approved",
      },
      orderBy: { createdAt: "desc" },
    })
    expect(adminAudits.length).toBe(beforeAuditCount + 1)
    expect(adminAudits[0].actorRole).toBe("admin")
    expect(adminAudits[0].entityType).toBe("DealRoom")
    expect(adminAudits[0].entityId).toBe(adminApprovalDealRoomId)
    expect((adminAudits[0].details as { approvalNote?: string }).approvalNote).toBe(`Admin approval ${seedSuffix}`)

    const adminWorkspaceResponse = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workspace?actingAsRole=admin`, {
      headers: getAuthHeaders(adminToken),
    })
    expect(adminWorkspaceResponse.status).toBe(200)

    const adminWorkspace = await adminWorkspaceResponse.json()
    expect(
      adminWorkspace.audits.some(
        (audit: { dealRoomId: string | null; actorUserId: string | null; action: string; entityId: string | null; details: { approvalNote?: string } }) =>
          audit.dealRoomId === adminApprovalDealRoomId &&
          audit.actorUserId === adminUserId &&
          audit.action === "agreement.approved" &&
          audit.entityId === adminApprovalDealRoomId &&
          audit.details.approvalNote === `Admin approval ${seedSuffix}`,
      ),
    ).toBe(true)
  })

  it("returns 403 when a normal member tries to escalate to reviewer or admin for agreement approval", async () => {
    const reviewerEscalationResponse = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(sponsorToken),
      },
      body: JSON.stringify({
        actingAsRole: "reviewer",
        action: "approveAgreement",
        dealRoomId: reviewerApprovalDealRoomId,
        approvalNote: `Illicit reviewer escalation ${seedSuffix}`,
      }),
    })

    expect(reviewerEscalationResponse.status).toBe(403)
    await expect(reviewerEscalationResponse.json()).resolves.toEqual({ error: "Forbidden" })

    const adminEscalationResponse = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workflows/deal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(sponsorToken),
      },
      body: JSON.stringify({
        actingAsRole: "admin",
        action: "approveAgreement",
        dealRoomId: adminApprovalDealRoomId,
        approvalNote: `Illicit admin escalation ${seedSuffix}`,
      }),
    })

    expect(adminEscalationResponse.status).toBe(403)
    await expect(adminEscalationResponse.json()).resolves.toEqual({ error: "Forbidden" })
  })

  it("keeps reviewer/admin approval audits hidden from unrelated non-privileged workspace views", async () => {
    const outsiderWorkspaceResponse = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workspace?actingAsRole=scientist`, {
      headers: getAuthHeaders(outsiderToken),
    })

    expect(outsiderWorkspaceResponse.status).toBe(200)
    const outsiderWorkspace = await outsiderWorkspaceResponse.json()

    expect(
      outsiderWorkspace.audits.some(
        (audit: { action: string; dealRoomId: string | null; actorUserId: string | null }) =>
          audit.action === "agreement.approved" &&
          (audit.dealRoomId === reviewerApprovalDealRoomId || audit.dealRoomId === adminApprovalDealRoomId),
      ),
    ).toBe(false)
    expect(
      outsiderWorkspace.audits.some(
        (audit: { action: string; actorUserId: string | null; entityId: string | null }) =>
          audit.action === "outsider.audit" && audit.actorUserId === outsiderUserId && audit.entityId === draftDiscoveryId,
      ),
    ).toBe(true)
  })

  it("keeps related deal-room audit rows visible in member workspace snapshots after privileged approvals", async () => {
    const ownerWorkspaceResponse = await fetch(`${testServerBaseUrl}/api/scientist-sponsor-marketplace/workspace?actingAsRole=scientist`, {
      headers: getAuthHeaders(ownerToken),
    })

    expect(ownerWorkspaceResponse.status).toBe(200)
    const ownerWorkspace = await ownerWorkspaceResponse.json()

    expect(
      ownerWorkspace.audits.some(
        (audit: { dealRoomId: string | null; action: string; actorUserId: string | null; details: { approvalNote?: string } }) =>
          audit.dealRoomId === reviewerApprovalDealRoomId &&
          audit.action === "agreement.approved" &&
          audit.actorUserId === reviewerUserId &&
          audit.details.approvalNote === `Reviewer approval ${seedSuffix}`,
      ),
    ).toBe(true)
    expect(
      ownerWorkspace.audits.some(
        (audit: { dealRoomId: string | null; action: string; actorUserId: string | null; details: { approvalNote?: string } }) =>
          audit.dealRoomId === adminApprovalDealRoomId &&
          audit.action === "agreement.approved" &&
          audit.actorUserId === adminUserId &&
          audit.details.approvalNote === `Admin approval ${seedSuffix}`,
      ),
    ).toBe(true)
  })
})