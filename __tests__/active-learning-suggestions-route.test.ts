import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()

const dbMock = {
  experimentCandidate: { findMany: vi.fn() },
}

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/db", () => ({ db: dbMock }))
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }))

const AUTHED = { user: { id: "user-1" } }

const SUGGESTION_ROWS = [
  {
    id: "cand-1",
    displayName: "Compound X",
    kind: "CHEMBL",
    status: "SCREENED",
    targetName: "SIRT1",
    acquisitionScore: 0.85,
    feedbackScore: 0.7,
    uncertaintyScore: 0.2,
    createdAt: new Date("2026-01-01"),
    feedbackRuns: [{ rationale: "2 results: activity 70%", nResults: 2, createdAt: new Date("2026-01-02") }],
  },
  {
    id: "cand-2",
    displayName: "Compound Y",
    kind: "CUSTOM",
    status: "RESULT_LOGGED",
    targetName: "mTOR",
    acquisitionScore: 0.6,
    feedbackScore: 0.5,
    uncertaintyScore: 0.4,
    createdAt: new Date("2026-01-01"),
    feedbackRuns: [],
  },
]

function getReq(params?: string) {
  return new NextRequest(`http://localhost/api/experiment/active-learning/suggestions${params ? `?${params}` : ""}`)
}

beforeEach(() => {
  vi.resetAllMocks()
  getServerSessionMock.mockResolvedValue(AUTHED)
  dbMock.experimentCandidate.findMany.mockResolvedValue(SUGGESTION_ROWS)
})

afterEach(() => { vi.resetModules() })

describe("GET /api/experiment/active-learning/suggestions", () => {
  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { GET } = await import("@/app/api/experiment/active-learning/suggestions/route")
    const res = await GET(getReq())
    expect(res.status).toBe(401)
  })

  it("returns 200 with suggestions array", async () => {
    const { GET } = await import("@/app/api/experiment/active-learning/suggestions/route")
    const res = await GET(getReq())
    expect(res.status).toBe(200)
    const body = await res.json() as { suggestions: unknown[]; total: number }
    expect(Array.isArray(body.suggestions)).toBe(true)
    expect(body.total).toBe(2)
  })

  it("excludes FED_BACK candidates from the query", async () => {
    const { GET } = await import("@/app/api/experiment/active-learning/suggestions/route")
    await GET(getReq())
    const whereArg = (dbMock.experimentCandidate.findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where
    expect(whereArg.status).toEqual({ not: "FED_BACK" })
  })

  it("orders by acquisitionScore descending", async () => {
    const { GET } = await import("@/app/api/experiment/active-learning/suggestions/route")
    await GET(getReq())
    const orderBy = (dbMock.experimentCandidate.findMany.mock.calls[0][0] as { orderBy: Record<string, string> }).orderBy
    expect(orderBy.acquisitionScore).toBe("desc")
  })

  it("respects limit query param (default 10)", async () => {
    const { GET } = await import("@/app/api/experiment/active-learning/suggestions/route")
    await GET(getReq())
    const takeArg = (dbMock.experimentCandidate.findMany.mock.calls[0][0] as { take: number }).take
    expect(takeArg).toBe(10)
  })

  it("clamps limit to MAX_LIMIT of 50", async () => {
    const { GET } = await import("@/app/api/experiment/active-learning/suggestions/route")
    await GET(getReq("limit=999"))
    const takeArg = (dbMock.experimentCandidate.findMany.mock.calls[0][0] as { take: number }).take
    expect(takeArg).toBe(50)
  })

  it("includes acquisitionScore, feedbackScore, and latestFeedback in each suggestion", async () => {
    const { GET } = await import("@/app/api/experiment/active-learning/suggestions/route")
    const res = await GET(getReq())
    const body = await res.json() as { suggestions: Array<{ acquisitionScore: number; feedbackScore: number; latestFeedback: unknown }> }
    expect(body.suggestions[0].acquisitionScore).toBe(0.85)
    expect(body.suggestions[0].feedbackScore).toBe(0.7)
    expect(body.suggestions[0].latestFeedback).toBeDefined()
  })

  it("sets latestFeedback to null when no feedback runs exist", async () => {
    const { GET } = await import("@/app/api/experiment/active-learning/suggestions/route")
    const res = await GET(getReq())
    const body = await res.json() as { suggestions: Array<{ latestFeedback: unknown }> }
    expect(body.suggestions[1].latestFeedback).toBeNull()
  })
})
