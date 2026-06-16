import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()

const dbMock = {
  experimentCandidate: { findMany: vi.fn() },
  marketplaceDiscovery: { findMany: vi.fn() },
  marketplaceTransaction: { findMany: vi.fn() },
  pilotMetricsSnapshot: { create: vi.fn() },
}

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/db", () => ({ db: dbMock }))
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }))

const AUTHED = { user: { id: "user-1" } }

const t0 = new Date("2026-01-01T00:00:00Z")
const t1 = new Date("2026-01-08T00:00:00Z")
const t2 = new Date("2026-01-15T00:00:00Z")
const t3 = new Date("2026-01-22T00:00:00Z")
const t4 = new Date("2026-01-29T00:00:00Z")

const FED_BACK_CANDIDATE = {
  id: "cand-1",
  createdAt: t0,
  status: "FED_BACK",
  acquisitionScore: 0.8,
  feedbackScore: 0.7,
  screenJson: { qed: 0.65, mol_log_p: 2.5, molecular_weight: 320 },
  labResults: [{ flag: "active" }],
  events: [
    { fromStatus: null, toStatus: "SCREENED", createdAt: t1 },
    { fromStatus: "SCREENED", toStatus: "SENT_TO_LAB", createdAt: t2 },
    { fromStatus: "SENT_TO_LAB", toStatus: "RESULT_LOGGED", createdAt: t3 },
    { fromStatus: "RESULT_LOGGED", toStatus: "FED_BACK", createdAt: t4 },
  ],
}

function getReq(params?: string) {
  return new NextRequest(`http://localhost/api/experiment/pilot-metrics${params ? `?${params}` : ""}`)
}

beforeEach(() => {
  vi.resetAllMocks()
  getServerSessionMock.mockResolvedValue(AUTHED)
  dbMock.experimentCandidate.findMany.mockResolvedValue([])
  dbMock.marketplaceDiscovery.findMany.mockResolvedValue([])
  dbMock.marketplaceTransaction.findMany.mockResolvedValue([])
  dbMock.pilotMetricsSnapshot.create.mockResolvedValue({})
})

afterEach(() => { vi.resetModules() })

describe("GET /api/experiment/pilot-metrics", () => {
  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { GET } = await import("@/app/api/experiment/pilot-metrics/route")
    const res = await GET(getReq())
    expect(res.status).toBe(401)
  })

  it("returns 200 with insufficientData=true when no FED_BACK candidates", async () => {
    const { GET } = await import("@/app/api/experiment/pilot-metrics/route")
    const res = await GET(getReq())
    expect(res.status).toBe(200)
    const body = await res.json() as { insufficientData: boolean }
    expect(body.insufficientData).toBe(true)
  })

  it("returns all four metric groups", async () => {
    dbMock.experimentCandidate.findMany.mockResolvedValue([FED_BACK_CANDIDATE])
    const { GET } = await import("@/app/api/experiment/pilot-metrics/route")
    const res = await GET(getReq())
    expect(res.status).toBe(200)
    const body = await res.json() as {
      hitRateUplift: unknown
      cost: unknown
      cycleTime: unknown
      classification: unknown
    }
    expect(body.hitRateUplift).toBeDefined()
    expect(body.cost).toBeDefined()
    expect(body.cycleTime).toBeDefined()
    expect(body.classification).toBeDefined()
  })

  it("reflects windowDays in the response", async () => {
    const { GET } = await import("@/app/api/experiment/pilot-metrics/route")
    const res = await GET(getReq("windowDays=30"))
    const body = await res.json() as { windowDays: number }
    expect(body.windowDays).toBe(30)
  })

  it("skips transaction query when no linked discoveries exist", async () => {
    dbMock.marketplaceDiscovery.findMany.mockResolvedValue([])
    const { GET } = await import("@/app/api/experiment/pilot-metrics/route")
    await GET(getReq())
    expect(dbMock.marketplaceTransaction.findMany).not.toHaveBeenCalled()
  })

  it("links transactions to candidates via MarketplaceDiscovery.candidateId", async () => {
    dbMock.experimentCandidate.findMany.mockResolvedValue([FED_BACK_CANDIDATE])
    dbMock.marketplaceDiscovery.findMany.mockResolvedValue([
      { id: "disc-1", candidateId: "cand-1" },
    ])
    dbMock.marketplaceTransaction.findMany.mockResolvedValue([
      { discoveryId: "disc-1", amountCents: 100_000 },
    ])
    const { GET } = await import("@/app/api/experiment/pilot-metrics/route")
    const res = await GET(getReq())
    const body = await res.json() as { cost: { totalSpendCents: number; validatedHits: number } }
    expect(body.cost.validatedHits).toBe(1)
    expect(body.cost.totalSpendCents).toBe(100_000)
  })

  it("persists a snapshot (fire-and-forget — does not block response)", async () => {
    dbMock.experimentCandidate.findMany.mockResolvedValue([FED_BACK_CANDIDATE])
    // Snapshot create resolves after response is returned; still gets called
    let resolvePersist!: () => void
    dbMock.pilotMetricsSnapshot.create.mockReturnValue(
      new Promise<void>((r) => { resolvePersist = r }),
    )
    const { GET } = await import("@/app/api/experiment/pilot-metrics/route")
    const res = await GET(getReq())
    expect(res.status).toBe(200) // did not wait for persist
    resolvePersist()
    await new Promise((r) => setTimeout(r, 0)) // flush microtasks
    expect(dbMock.pilotMetricsSnapshot.create).toHaveBeenCalledTimes(1)
  })

  it("includes computedAt ISO timestamp in the response", async () => {
    const { GET } = await import("@/app/api/experiment/pilot-metrics/route")
    const res = await GET(getReq())
    const body = await res.json() as { computedAt: string }
    expect(new Date(body.computedAt).getTime()).toBeGreaterThan(0)
  })
})
