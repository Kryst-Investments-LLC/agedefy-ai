import { NextRequest, NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const ensureMarketplaceActorsMock = vi.fn()
const resolveRoleMock = vi.fn()
const buildMarketplaceActorContextMock = vi.fn()
const assertEntityRecordAccessMock = vi.fn()
const assertDealRoomAccessMock = vi.fn()
const discoveriesGetByIdMock = vi.fn()
const ensureScientistProfileMock = vi.fn()
const ensureSponsorProfileMock = vi.fn()
const sendMessageMock = vi.fn()
const markMilestoneCompleteMock = vi.fn()
const approveAndReleaseMock = vi.fn()
const rejectPayoutReviewMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/db", () => ({
  db: {},
}))

vi.mock("@/scientist-sponsor-marketplace/backend/integrations/identityIntegration", () => ({
  identityIntegration: {
    ensureMarketplaceActors: ensureMarketplaceActorsMock,
    resolveRole: resolveRoleMock,
  },
}))

vi.mock("@/scientist-sponsor-marketplace/backend/permissions/access-control", () => ({
  buildMarketplaceActorContext: buildMarketplaceActorContextMock,
  assertEntityRecordAccess: assertEntityRecordAccessMock,
  assertEntityCreateAccess: vi.fn(),
  filterAccessibleRecords: vi.fn(),
  assertDealRoomAccess: assertDealRoomAccessMock,
  assertDiscoveryOwnership: vi.fn(),
  assertDiscoveryReadableBySponsor: vi.fn(),
  assertFundingRequestOwnership: vi.fn(),
}))

vi.mock("@/scientist-sponsor-marketplace/backend/services", () => ({
  marketplaceServices: {
    discoveries: {
      getById: discoveriesGetByIdMock,
    },
  },
}))

vi.mock("@/scientist-sponsor-marketplace/backend/services/scientistService", () => ({
  ensureScientistProfile: ensureScientistProfileMock,
}))

vi.mock("@/scientist-sponsor-marketplace/backend/services/sponsorService", () => ({
  ensureSponsorProfile: ensureSponsorProfileMock,
}))

vi.mock("@/scientist-sponsor-marketplace/backend/workflows/scientistWorkflow", () => ({
  scientistWorkflow: {},
}))

vi.mock("@/scientist-sponsor-marketplace/backend/workflows/sponsorWorkflow", () => ({
  sponsorWorkflow: {},
}))

vi.mock("@/scientist-sponsor-marketplace/backend/workflows/dealWorkflow", () => ({
  dealWorkflow: {
    sendMessage: sendMessageMock,
    markMilestoneComplete: markMilestoneCompleteMock,
    approveAndRelease: approveAndReleaseMock,
    rejectPayoutReview: rejectPayoutReviewMock,
  },
}))

function createSession(role = "MEMBER") {
  return {
    user: {
      id: "user-1",
      name: "Route Test User",
      role,
    },
  }
}

function createActor(role = "scientist") {
  return {
    userId: "user-1",
    role,
    globalRole: "MEMBER",
    scientistId: "scientist-1",
    sponsorId: "sponsor-1",
  }
}

describe("scientist sponsor marketplace API routes", () => {
  beforeEach(() => {
    vi.resetModules()
    getServerSessionMock.mockReset()
    ensureMarketplaceActorsMock.mockReset()
    resolveRoleMock.mockReset()
    buildMarketplaceActorContextMock.mockReset()
    assertEntityRecordAccessMock.mockReset()
    assertDealRoomAccessMock.mockReset()
    discoveriesGetByIdMock.mockReset()
    ensureScientistProfileMock.mockReset()
    ensureSponsorProfileMock.mockReset()
    sendMessageMock.mockReset()
    markMilestoneCompleteMock.mockReset()
    approveAndReleaseMock.mockReset()
    rejectPayoutReviewMock.mockReset()

    buildMarketplaceActorContextMock.mockResolvedValue(createActor())
    ensureMarketplaceActorsMock.mockResolvedValue({})
    ensureScientistProfileMock.mockResolvedValue({ id: "scientist-1" })
    ensureSponsorProfileMock.mockResolvedValue({ id: "sponsor-1" })
    resolveRoleMock.mockReturnValue("sponsor")
  })

  it("returns 401 from the item route when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/[entity]/[id]/route")

    const response = await routeModule.GET!(
      new NextRequest("http://localhost:3000/api/scientist-sponsor-marketplace/discoveries/discovery-1"),
      { params: Promise.resolve({ entity: "discoveries", id: "discovery-1" }) },
    ) as Response

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("returns the discovery from the item route when sponsor read is allowed", async () => {
    getServerSessionMock.mockResolvedValue(createSession())
    buildMarketplaceActorContextMock.mockResolvedValue(createActor("sponsor"))
    const discovery = {
      id: "discovery-1",
      scientistId: "scientist-1",
      status: "PUBLISHED",
      title: "Published Discovery",
    }
    discoveriesGetByIdMock.mockResolvedValue(discovery)
    assertEntityRecordAccessMock.mockResolvedValue(null)

    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/[entity]/[id]/route")
    const response = await routeModule.GET!(
      new NextRequest("http://localhost:3000/api/scientist-sponsor-marketplace/discoveries/discovery-1?actingAsRole=sponsor"),
      { params: Promise.resolve({ entity: "discoveries", id: "discovery-1" }) },
    ) as Response

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(discovery)
    expect(buildMarketplaceActorContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        requestedRole: "sponsor",
      }),
    )
  })

  it("returns 403 from the item route when record access is denied", async () => {
    getServerSessionMock.mockResolvedValue(createSession())
    discoveriesGetByIdMock.mockResolvedValue({
      id: "discovery-1",
      scientistId: "scientist-1",
      status: "DRAFT",
    })
    assertEntityRecordAccessMock.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }))

    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/[entity]/[id]/route")
    const response = await routeModule.GET!(
      new NextRequest("http://localhost:3000/api/scientist-sponsor-marketplace/discoveries/discovery-1?actingAsRole=scientist"),
      { params: Promise.resolve({ entity: "discoveries", id: "discovery-1" }) },
    ) as Response

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
  })

  it("returns 403 from the deal workflow route when a non-member tries to message the room", async () => {
    getServerSessionMock.mockResolvedValue(createSession())
    assertDealRoomAccessMock.mockResolvedValue({
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    })

    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/workflows/[workflow]/route")
    const response = await routeModule.POST!(
      new NextRequest("http://localhost:3000/api/scientist-sponsor-marketplace/workflows/deal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actingAsRole: "sponsor",
          action: "message",
          dealRoomId: "deal-room-1",
          body: "Need diligence materials",
        }),
      }),
      { params: Promise.resolve({ workflow: "deal" }) },
    ) as Response

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it("returns 403 from the deal workflow route when a sponsor tries to mark a milestone complete", async () => {
    getServerSessionMock.mockResolvedValue(createSession())
    buildMarketplaceActorContextMock.mockResolvedValue(createActor("sponsor"))
    resolveRoleMock.mockReturnValue("sponsor")
    assertDealRoomAccessMock.mockResolvedValue({ response: null, dealRoom: { id: "deal-room-1" } })

    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/workflows/[workflow]/route")
    const response = await routeModule.POST!(
      new NextRequest("http://localhost:3000/api/scientist-sponsor-marketplace/workflows/deal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actingAsRole: "sponsor",
          action: "markMilestoneComplete",
          dealRoomId: "deal-room-1",
          transactionId: "transaction-1",
        }),
      }),
      { params: Promise.resolve({ workflow: "deal" }) },
    ) as Response

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
    expect(markMilestoneCompleteMock).not.toHaveBeenCalled()
  })

  it("returns 403 from the deal workflow route when a scientist tries to approve and release payout", async () => {
    getServerSessionMock.mockResolvedValue(createSession())
    buildMarketplaceActorContextMock.mockResolvedValue(createActor("scientist"))
    resolveRoleMock.mockReturnValue("scientist")
    assertDealRoomAccessMock.mockResolvedValue({ response: null, dealRoom: { id: "deal-room-1" } })

    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/workflows/[workflow]/route")
    const response = await routeModule.POST!(
      new NextRequest("http://localhost:3000/api/scientist-sponsor-marketplace/workflows/deal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actingAsRole: "scientist",
          action: "approveAndRelease",
          dealRoomId: "deal-room-1",
          transactionId: "transaction-1",
        }),
      }),
      { params: Promise.resolve({ workflow: "deal" }) },
    ) as Response

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
    expect(approveAndReleaseMock).not.toHaveBeenCalled()
  })

  it("returns 403 from the deal workflow route when a scientist tries to reject payout review", async () => {
    getServerSessionMock.mockResolvedValue(createSession())
    buildMarketplaceActorContextMock.mockResolvedValue(createActor("scientist"))
    resolveRoleMock.mockReturnValue("scientist")
    assertDealRoomAccessMock.mockResolvedValue({ response: null, dealRoom: { id: "deal-room-1" } })

    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/workflows/[workflow]/route")
    const response = await routeModule.POST!(
      new NextRequest("http://localhost:3000/api/scientist-sponsor-marketplace/workflows/deal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actingAsRole: "scientist",
          action: "rejectPayoutReview",
          dealRoomId: "deal-room-1",
          transactionId: "transaction-1",
        }),
      }),
      { params: Promise.resolve({ workflow: "deal" }) },
    ) as Response

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
    expect(rejectPayoutReviewMock).not.toHaveBeenCalled()
  })
})