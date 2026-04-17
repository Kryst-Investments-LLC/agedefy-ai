import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const buildActorMock = vi.fn()
const ensureMarketplaceActorsMock = vi.fn()
const canViewDealRoomMock = vi.fn()
const matchScoreListMock = vi.fn()
const upsertMatchScoreMock = vi.fn()
const canPerformMock = vi.fn()

const discoveryFindManyMock = vi.fn()
const fundingRequestFindManyMock = vi.fn()
const dealRoomFindManyMock = vi.fn()
const notificationFindManyMock = vi.fn()
const auditLogFindManyMock = vi.fn()
const messageThreadFindManyMock = vi.fn()
const transactionFindManyMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/db", () => ({
  db: {
    marketplaceDiscovery: { findMany: discoveryFindManyMock },
    marketplaceFundingRequest: { findMany: fundingRequestFindManyMock },
    marketplaceDealRoom: { findMany: dealRoomFindManyMock },
    marketplaceNotification: { findMany: notificationFindManyMock },
    marketplaceAuditLog: { findMany: auditLogFindManyMock },
    marketplaceMessageThread: { findMany: messageThreadFindManyMock },
    marketplaceTransaction: { findMany: transactionFindManyMock },
  },
}))

vi.mock("@/scientist-sponsor-marketplace/backend/integrations/identityIntegration", () => ({
  identityIntegration: {
    buildActor: buildActorMock,
    ensureMarketplaceActors: ensureMarketplaceActorsMock,
  },
}))

vi.mock("@/scientist-sponsor-marketplace/backend/services/complianceService", () => ({
  complianceService: {
    canViewDealRoom: canViewDealRoomMock,
  },
}))

vi.mock("@/scientist-sponsor-marketplace/backend/matching/matchingEngine", () => ({
  rankDiscoveriesForSponsor: vi.fn(() => []),
}))

vi.mock("@/scientist-sponsor-marketplace/backend/services/matchScoreService", () => ({
  matchScoreService: {
    list: matchScoreListMock,
  },
  upsertMatchScore: upsertMatchScoreMock,
}))

vi.mock("@/scientist-sponsor-marketplace/backend/permissions/permissions", () => ({
  canPerform: canPerformMock,
}))

function createSession(role = "MEMBER") {
  return {
    user: {
      id: "user-1",
      email: "route-test@example.com",
      name: "Route Test User",
      role,
    },
  }
}

function createScientist() {
  return {
    id: "scientist-1",
    userId: "user-1",
    displayName: "Scientist User",
    institution: "Biozephyra Lab",
    specialty: "Longevity",
    biography: "Bio",
    categories: ["Longevity"],
    fundingStage: "pre-seed",
    reputationScore: 0.5,
    evidenceCount: 1,
    publishedDiscoveryCount: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  }
}

function createSponsor() {
  return {
    id: "sponsor-1",
    userId: "user-1",
    organizationName: "Growth Capital",
    organizationType: "venture",
    thesis: "Longevity thesis",
    preferredCategories: ["Longevity"],
    preferredStages: ["clinical"],
    maxBudgetCents: 500000,
    minImpactScore: 0.5,
    capitalAvailableCents: 1000000,
    dueDiligenceLevel: "standard",
    geographyFocus: ["US"],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  }
}

function createDealRoom(id: string) {
  return {
    id,
    discoveryId: `discovery-${id}`,
    scientistId: "scientist-1",
    sponsorId: "sponsor-1",
    status: "OPEN",
    ndaRequired: true,
    ndaAcceptedAt: null,
    agreementStatus: "REVIEW",
    agreementTerms: { exclusivityDays: 30 },
    documentVault: [],
    lastActivityAt: new Date("2026-02-01T00:00:00Z"),
    createdAt: new Date("2026-02-01T00:00:00Z"),
    updatedAt: new Date("2026-02-01T00:00:00Z"),
  }
}

function createAudit(input: { id: string; actorUserId: string | null; dealRoomId?: string | null; action: string }) {
  return {
    id: input.id,
    dealRoomId: input.dealRoomId ?? null,
    actorUserId: input.actorUserId,
    actorRole: input.actorUserId === "reviewer-user" ? "reviewer" : input.actorUserId === "admin-user" ? "admin" : "scientist",
    action: input.action,
    entityType: "DealRoom",
    entityId: input.dealRoomId ?? null,
    ipAddress: null,
    details: { marker: input.id },
    createdAt: new Date("2026-02-02T00:00:00Z"),
  }
}

describe("scientist sponsor marketplace workspace route", () => {
  beforeEach(() => {
    vi.resetModules()
    getServerSessionMock.mockReset()
    buildActorMock.mockReset()
    ensureMarketplaceActorsMock.mockReset()
    canViewDealRoomMock.mockReset()
    matchScoreListMock.mockReset()
    upsertMatchScoreMock.mockReset()
    canPerformMock.mockReset()
    discoveryFindManyMock.mockReset()
    fundingRequestFindManyMock.mockReset()
    dealRoomFindManyMock.mockReset()
    notificationFindManyMock.mockReset()
    auditLogFindManyMock.mockReset()
    messageThreadFindManyMock.mockReset()
    transactionFindManyMock.mockReset()

    ensureMarketplaceActorsMock.mockResolvedValue({ scientist: createScientist(), sponsor: createSponsor() })
    canPerformMock.mockReturnValue(false)
    discoveryFindManyMock
      .mockResolvedValueOnce([
        {
          id: "discovery-1",
          scientistId: "scientist-1",
          title: "Discovery",
          slug: "discovery",
          category: "Longevity",
          summary: "Summary",
          developmentStage: "clinical",
          status: "PUBLISHED",
          scientificImpactScore: 0.8,
          commercialReadiness: 0.7,
          fundingGoalCents: 100000,
          currency: "USD",
          evidenceSummary: null,
          evidenceLinks: [],
          metadata: {},
          publishedAt: new Date("2026-02-01T00:00:00Z"),
          createdAt: new Date("2026-02-01T00:00:00Z"),
          updatedAt: new Date("2026-02-01T00:00:00Z"),
        },
      ])
      .mockResolvedValueOnce([])
    fundingRequestFindManyMock.mockResolvedValue([])
    dealRoomFindManyMock.mockResolvedValue([createDealRoom("deal-room-1")])
    notificationFindManyMock.mockResolvedValue([])
    messageThreadFindManyMock.mockResolvedValue([])
    transactionFindManyMock.mockResolvedValue([])
    matchScoreListMock.mockResolvedValue([])
    upsertMatchScoreMock.mockResolvedValue(undefined)
  })

  it("returns only actor-owned or related deal-room audits for non-privileged actors", async () => {
    getServerSessionMock.mockResolvedValue(createSession("MEMBER"))
    buildActorMock.mockReturnValue({
      userId: "user-1",
      email: "route-test@example.com",
      name: "Route Test User",
      globalRole: "MEMBER",
      actingAs: "scientist",
    })
    canViewDealRoomMock.mockImplementation((role, dealRoom) => role === "scientist" && dealRoom.id === "deal-room-1")
    auditLogFindManyMock.mockResolvedValue([
      createAudit({ id: "audit-own", actorUserId: "user-1", action: "own.action" }),
      createAudit({ id: "audit-related", actorUserId: "reviewer-user", dealRoomId: "deal-room-1", action: "agreement.approved" }),
      createAudit({ id: "audit-unrelated", actorUserId: "admin-user", dealRoomId: "deal-room-9", action: "agreement.approved" }),
    ])

    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/workspace/route")
    const response = await routeModule.GET!(new Request("http://localhost:3000/api/scientist-sponsor-marketplace/workspace?actingAsRole=scientist")) as Response

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.actor.actingAs).toBe("scientist")
    expect(payload.audits.map((audit: { id: string }) => audit.id)).toEqual(expect.arrayContaining(["audit-own", "audit-related"]))
    expect(payload.audits.map((audit: { id: string }) => audit.id)).not.toContain("audit-unrelated")
  })

  it("returns full recent audits for privileged reviewer workspace views", async () => {
    getServerSessionMock.mockResolvedValue(createSession("RESEARCHER"))
    buildActorMock.mockReturnValue({
      userId: "reviewer-user",
      email: "reviewer@example.com",
      name: "Reviewer User",
      globalRole: "RESEARCHER",
      actingAs: "reviewer",
    })
    canViewDealRoomMock.mockReturnValue(false)
    auditLogFindManyMock.mockResolvedValue([
      createAudit({ id: "audit-own", actorUserId: "reviewer-user", action: "own.action" }),
      createAudit({ id: "audit-related", actorUserId: "admin-user", dealRoomId: "deal-room-1", action: "agreement.approved" }),
      createAudit({ id: "audit-unrelated", actorUserId: "user-9", dealRoomId: "deal-room-9", action: "outsider.audit" }),
    ])

    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/workspace/route")
    const response = await routeModule.GET!(new Request("http://localhost:3000/api/scientist-sponsor-marketplace/workspace?actingAsRole=reviewer")) as Response

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.actor.actingAs).toBe("reviewer")
    expect(payload.audits.map((audit: { id: string }) => audit.id)).toEqual(["audit-own", "audit-related", "audit-unrelated"])
  })
})