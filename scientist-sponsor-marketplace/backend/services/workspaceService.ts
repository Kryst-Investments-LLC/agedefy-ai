import { db } from "@/lib/db"
import {
  normalizeAuditLog,
  normalizeDealRoom,
  normalizeDiscovery,
  normalizeFundingRequest,
  normalizeMatchScore,
  normalizeMessageThread,
  normalizeNotification,
  normalizeScientist,
  normalizeSponsor,
  normalizeTransaction,
} from "@/scientist-sponsor-marketplace/backend/models/normalizers"
import { complianceService } from "@/scientist-sponsor-marketplace/backend/services/complianceService"
import { canPerform } from "@/scientist-sponsor-marketplace/backend/permissions/permissions"
import { identityIntegration } from "@/scientist-sponsor-marketplace/backend/integrations/identityIntegration"
import { rankDiscoveriesForSponsor } from "@/scientist-sponsor-marketplace/backend/matching/matchingEngine"
import { matchScoreService, upsertMatchScore } from "@/scientist-sponsor-marketplace/backend/services/matchScoreService"
import type { MarketplacePermission, MarketplaceRole, MarketplaceWorkspaceSnapshot } from "@/scientist-sponsor-marketplace/shared/types/entities"
import { sumBy } from "@/scientist-sponsor-marketplace/shared/utils"

const permissionList: MarketplacePermission[] = [
  "publishDiscovery",
  "fundProject",
  "viewDealRoom",
  "messageDealRoom",
  "approveAgreement",
  "manageScientistProfile",
  "manageSponsorProfile",
  "manageFundingRequest",
  "manageDiscovery",
  "manageMatchScore",
  "manageDealRoom",
  "manageTransaction",
  "readAuditLog",
  "manageNotification",
]

export async function getMarketplaceWorkspaceSnapshot(params: {
  userId: string
  email: string | null
  name: string | null
  globalRole: string
  requestedRole?: MarketplaceRole
}): Promise<MarketplaceWorkspaceSnapshot> {
  const actor = identityIntegration.buildActor(params)
  const { scientist, sponsor } = await identityIntegration.ensureMarketplaceActors({ id: params.userId, name: params.name })

  const [discoveries, fundingRequests, dealRooms, notifications, audits] = await Promise.all([
    db.marketplaceDiscovery.findMany({ where: { scientistId: scientist.id }, orderBy: { updatedAt: "desc" } }),
    db.marketplaceFundingRequest.findMany({ where: { scientistId: scientist.id }, orderBy: { updatedAt: "desc" } }),
    db.marketplaceDealRoom.findMany({
      where: {
        OR: [{ scientistId: scientist.id }, { sponsorId: sponsor.id }],
      },
      orderBy: { lastActivityAt: "desc" },
    }),
    db.marketplaceNotification.findMany({ where: { recipientUserId: params.userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.marketplaceAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ])

  const [messages, transactions, publishedDiscoveries, allFundingRequests] = await Promise.all([
    db.marketplaceMessageThread.findMany({
      where: { dealRoomId: { in: dealRooms.map((dealRoom) => dealRoom.id) } },
      orderBy: { createdAt: "asc" },
    }),
    db.marketplaceTransaction.findMany({
      where: { dealRoomId: { in: dealRooms.map((dealRoom) => dealRoom.id) } },
      orderBy: { createdAt: "desc" },
    }),
    db.marketplaceDiscovery.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ scientificImpactScore: "desc" }, { updatedAt: "desc" }] }),
    db.marketplaceFundingRequest.findMany({ orderBy: { updatedAt: "desc" } }),
  ])

  const rankedMatches = rankDiscoveriesForSponsor({
    discoveries: publishedDiscoveries.map(normalizeDiscovery),
    sponsor: normalizeSponsor(sponsor),
    fundingRequests: allFundingRequests.map(normalizeFundingRequest),
  }).slice(0, 8)

  await Promise.all(
    rankedMatches.map((match, index) =>
      upsertMatchScore({
        discoveryId: match.discovery.id,
        scientistId: match.discovery.scientistId,
        sponsorId: sponsor.id,
        overallScore: match.overallScore,
        ruleBasedScore: match.ruleBasedScore,
        aiAugmentedScore: match.aiAugmentedScore,
        weightedBreakdown: match.score,
        sponsorPreferenceFit: (match.score.categoryFit + match.score.stageFit) / 2,
        metadataFit: match.score.metadataFit,
        rationale: match.rationale,
        rank: index + 1,
      }),
    ),
  )

  const [scientistMatchScores, sponsorMatchScores] = await Promise.all([
    matchScoreService.list({ where: { scientistId: scientist.id }, orderBy: { overallScore: "desc" } }),
    matchScoreService.list({ where: { sponsorId: sponsor.id }, orderBy: [{ rank: "asc" }, { overallScore: "desc" }] }),
  ])

  const accessibleDealRoomIds = new Set(
    dealRooms
      .filter((dealRoom) => complianceService.canViewDealRoom(actor.actingAs, normalizeDealRoom(dealRoom), scientist.id, sponsor.id))
      .map((dealRoom) => dealRoom.id),
  )
  const visibleAudits = actor.actingAs === "admin" || actor.actingAs === "reviewer"
    ? audits
    : audits.filter((audit) => audit.actorUserId === params.userId || (audit.dealRoomId ? accessibleDealRoomIds.has(audit.dealRoomId) : false))

  const permissions = Object.fromEntries(permissionList.map((permission) => [permission, canPerform(actor.actingAs, permission)])) as Record<MarketplacePermission, boolean>

  return {
    actor,
    scientist: normalizeScientist(scientist),
    sponsor: normalizeSponsor(sponsor),
    discoveries: discoveries.map(normalizeDiscovery),
    fundingRequests: fundingRequests.map(normalizeFundingRequest),
    scientistMatchScores: scientistMatchScores.map(normalizeMatchScore),
    sponsorMatchScores: sponsorMatchScores.map(normalizeMatchScore),
    dealRooms: dealRooms.map(normalizeDealRoom),
    messages: messages.map(normalizeMessageThread),
    transactions: transactions.map(normalizeTransaction),
    audits: visibleAudits.map(normalizeAuditLog),
    notifications: notifications.map(normalizeNotification),
    permissions,
    metrics: {
      publishedDiscoveries: discoveries.filter((item) => item.status === "PUBLISHED").length,
      openDealRooms: dealRooms.filter((item) => item.status !== "CLOSED").length,
      fundedVolumeCents: sumBy(transactions, (item) => item.amountCents),
      unreadNotifications: notifications.filter((item) => item.status !== "READ").length,
    },
  }
}
