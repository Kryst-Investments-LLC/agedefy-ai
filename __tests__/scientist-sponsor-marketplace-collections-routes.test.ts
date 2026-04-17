import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const getMarketplaceWorkspaceSnapshotMock = vi.fn()
const ensureMarketplaceActorsMock = vi.fn()
const buildMarketplaceActorContextMock = vi.fn()
const filterAccessibleRecordsMock = vi.fn()
const discoveriesListMock = vi.fn()
const dealRoomsListMock = vi.fn()
const notificationsListMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/scientist-sponsor-marketplace/backend/services/workspaceService", () => ({
  getMarketplaceWorkspaceSnapshot: getMarketplaceWorkspaceSnapshotMock,
}))

vi.mock("@/scientist-sponsor-marketplace/backend/integrations/identityIntegration", () => ({
  identityIntegration: {
    ensureMarketplaceActors: ensureMarketplaceActorsMock,
  },
}))

vi.mock("@/scientist-sponsor-marketplace/backend/permissions/access-control", () => ({
  buildMarketplaceActorContext: buildMarketplaceActorContextMock,
  assertEntityCreateAccess: vi.fn(),
  assertEntityRecordAccess: vi.fn(),
  filterAccessibleRecords: filterAccessibleRecordsMock,
}))

vi.mock("@/scientist-sponsor-marketplace/backend/services", () => ({
  marketplaceServices: {
    discoveries: {
      list: discoveriesListMock,
    },
    dealRooms: {
      list: dealRoomsListMock,
    },
    notifications: {
      list: notificationsListMock,
    },
  },
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

describe("scientist sponsor marketplace collection routes", () => {
  beforeEach(() => {
    vi.resetModules()
    getServerSessionMock.mockReset()
    getMarketplaceWorkspaceSnapshotMock.mockReset()
    ensureMarketplaceActorsMock.mockReset()
    buildMarketplaceActorContextMock.mockReset()
    filterAccessibleRecordsMock.mockReset()
    discoveriesListMock.mockReset()
    dealRoomsListMock.mockReset()
    notificationsListMock.mockReset()
  })

  it("returns 401 from workspace route when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/workspace/route")

    const response = await routeModule.GET!(new Request("http://localhost:3000/api/scientist-sponsor-marketplace/workspace")) as Response

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("returns the workspace snapshot and forwards the requested role", async () => {
    getServerSessionMock.mockResolvedValue(createSession("RESEARCHER"))
    const snapshot = {
      actor: { actingAs: "reviewer", globalRole: "RESEARCHER" },
      discoveries: [],
      fundingRequests: [],
      scientistMatchScores: [],
      sponsorMatchScores: [],
      dealRooms: [],
      messages: [],
      transactions: [],
      audits: [],
      notifications: [],
      permissions: {},
      metrics: {
        publishedDiscoveries: 0,
        openDealRooms: 0,
        fundedVolumeCents: 0,
        unreadNotifications: 0,
      },
      scientist: null,
      sponsor: null,
    }
    getMarketplaceWorkspaceSnapshotMock.mockResolvedValue(snapshot)

    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/workspace/route")
    const response = await routeModule.GET!(
      new Request("http://localhost:3000/api/scientist-sponsor-marketplace/workspace?actingAsRole=reviewer"),
    ) as Response

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(snapshot)
    expect(getMarketplaceWorkspaceSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        globalRole: "RESEARCHER",
        requestedRole: "reviewer",
      }),
    )
  })

  it("returns the filtered discovery collection for the signed-in actor", async () => {
    getServerSessionMock.mockResolvedValue(createSession())
    ensureMarketplaceActorsMock.mockResolvedValue({})
    buildMarketplaceActorContextMock.mockResolvedValue({
      userId: "user-1",
      role: "sponsor",
      globalRole: "MEMBER",
      scientistId: "scientist-1",
      sponsorId: "sponsor-1",
    })

    const allRecords = [
      { id: "published-1", status: "PUBLISHED", title: "Published" },
      { id: "draft-1", status: "DRAFT", title: "Draft" },
    ]
    const filteredRecords = [allRecords[0]]

    discoveriesListMock.mockResolvedValue(allRecords)
    filterAccessibleRecordsMock.mockResolvedValue(filteredRecords)

    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/[entity]/route")
    const response = await routeModule.GET!(
      new NextRequest("http://localhost:3000/api/scientist-sponsor-marketplace/discoveries?actingAsRole=sponsor"),
      { params: Promise.resolve({ entity: "discoveries" }) },
    ) as Response

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      entity: "Discovery",
      records: filteredRecords,
      actingAs: "sponsor",
    })
    expect(filterAccessibleRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: "sponsor" }),
      "discoveries",
      allRecords,
    )
  })

  it("returns the filtered deal-room collection for the signed-in actor", async () => {
    getServerSessionMock.mockResolvedValue(createSession())
    ensureMarketplaceActorsMock.mockResolvedValue({})
    buildMarketplaceActorContextMock.mockResolvedValue({
      userId: "user-1",
      role: "sponsor",
      globalRole: "MEMBER",
      scientistId: "scientist-1",
      sponsorId: "sponsor-1",
    })

    const allRecords = [
      { id: "deal-room-1", sponsorId: "sponsor-1", status: "OPEN" },
      { id: "deal-room-2", sponsorId: "sponsor-9", status: "OPEN" },
    ]
    const filteredRecords = [allRecords[0]]

    dealRoomsListMock.mockResolvedValue(allRecords)
    filterAccessibleRecordsMock.mockResolvedValue(filteredRecords)

    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/[entity]/route")
    const response = await routeModule.GET!(
      new NextRequest("http://localhost:3000/api/scientist-sponsor-marketplace/dealRooms?actingAsRole=sponsor"),
      { params: Promise.resolve({ entity: "dealRooms" }) },
    ) as Response

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      entity: "Deal Room",
      records: filteredRecords,
      actingAs: "sponsor",
    })
    expect(filterAccessibleRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: "sponsor" }),
      "dealRooms",
      allRecords,
    )
  })

  it("returns the filtered notification collection for the signed-in actor", async () => {
    getServerSessionMock.mockResolvedValue(createSession())
    ensureMarketplaceActorsMock.mockResolvedValue({})
    buildMarketplaceActorContextMock.mockResolvedValue({
      userId: "user-1",
      role: "scientist",
      globalRole: "MEMBER",
      scientistId: "scientist-1",
      sponsorId: "sponsor-1",
    })

    const allRecords = [
      { id: "notification-1", recipientUserId: "user-1", title: "Visible" },
      { id: "notification-2", recipientUserId: "user-9", title: "Hidden" },
    ]
    const filteredRecords = [allRecords[0]]

    notificationsListMock.mockResolvedValue(allRecords)
    filterAccessibleRecordsMock.mockResolvedValue(filteredRecords)

    const routeModule = await import("@/app/api/scientist-sponsor-marketplace/[entity]/route")
    const response = await routeModule.GET!(
      new NextRequest("http://localhost:3000/api/scientist-sponsor-marketplace/notifications?actingAsRole=scientist"),
      { params: Promise.resolve({ entity: "notifications" }) },
    ) as Response

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      entity: "Notification",
      records: filteredRecords,
      actingAs: "scientist",
    })
    expect(filterAccessibleRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: "scientist" }),
      "notifications",
      allRecords,
    )
  })
})