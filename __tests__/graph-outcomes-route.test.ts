import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const findManyMock = vi.fn()

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/rate-limit", () => ({ applyRateLimit: applyRateLimitMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db: { kgEdge: { findMany: findManyMock } } }))

const RESEARCHER = { user: { id: "r1", email: "r@example.com", role: "RESEARCHER" } }
const USER = { user: { id: "u1", email: "u@example.com", role: "USER" } }

const EDGE_ROW = {
  evidenceGrade: "C_LOW",
  source: "biozephyra-rwe",
  effectSize: -0.18,
  effectSizeUnit: "z-score",
  confidence: 0.7,
  attributes: { sampleSize: 120, pValue: 0.01, period: "2026-Q2", claimType: "population_association" },
  fromNode: { label: "Rapamycin", kind: "compound", externalId: "bzkg1:abc" },
  toNode: { label: "hs-CRP", kind: "biomarker", externalId: "bzkg1:def" },
}

function buildRequest(query = "") {
  return new NextRequest(`http://localhost:3000/api/graph/outcomes${query}`, { method: "GET" })
}

beforeEach(() => {
  getServerSessionMock.mockReset()
  getServerSessionMock.mockResolvedValue(RESEARCHER)
  applyRateLimitMock.mockReset()
  applyRateLimitMock.mockReturnValue(null)
  findManyMock.mockReset()
  findManyMock.mockResolvedValue([EDGE_ROW])
})

afterEach(() => {
  vi.resetModules()
})

describe("GET /api/graph/outcomes", () => {
  it("returns 401 for unauthenticated callers", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { GET } = await import("@/app/api/graph/outcomes/route")
    expect((await GET(buildRequest())).status).toBe(401)
  })

  it("returns 403 for non-researcher roles", async () => {
    getServerSessionMock.mockResolvedValue(USER)
    const { GET } = await import("@/app/api/graph/outcomes/route")
    expect((await GET(buildRequest())).status).toBe(403)
  })

  it("does not query the graph for a forbidden role", async () => {
    getServerSessionMock.mockResolvedValue(USER)
    const { GET } = await import("@/app/api/graph/outcomes/route")
    await GET(buildRequest())
    expect(findManyMock).not.toHaveBeenCalled()
  })

  it("returns the rate-limit response when rate-limited", async () => {
    applyRateLimitMock.mockReturnValue(
      new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429 }),
    )
    const { GET } = await import("@/app/api/graph/outcomes/route")
    expect((await GET(buildRequest())).status).toBe(429)
  })

  it("returns 400 for an invalid minGrade", async () => {
    const { GET } = await import("@/app/api/graph/outcomes/route")
    expect((await GET(buildRequest("?minGrade=SUPER_HIGH"))).status).toBe(400)
  })

  it("returns 200 with shaped outcomes and mandatory framing", async () => {
    const { GET } = await import("@/app/api/graph/outcomes/route")
    const res = await GET(buildRequest())
    expect(res.status).toBe(200)
    const json = (await res.json()) as Record<string, any>
    expect(json.count).toBe(1)
    expect(json.outcomes[0].intervention.label).toBe("Rapamycin")
    expect(json.outcomes[0].outcome.label).toBe("hs-CRP")
    expect(json.framing.notice).toMatch(/not medical advice/i)
  })

  it("re-enforces the k-anon floor: below-floor edges are suppressed in the response", async () => {
    findManyMock.mockResolvedValue([{ ...EDGE_ROW, attributes: { sampleSize: 3 } }])
    const { GET } = await import("@/app/api/graph/outcomes/route")
    const res = await GET(buildRequest())
    const body = (await res.json()) as Record<string, any>
    expect(body.count).toBe(0)
    expect(body.suppressedBelowFloor).toBe(1)
  })

  it("never leaks node externalId into the response payload", async () => {
    const { GET } = await import("@/app/api/graph/outcomes/route")
    const res = await GET(buildRequest())
    const text = JSON.stringify(await res.json())
    expect(text).not.toContain("externalId")
    expect(text).not.toContain("bzkg1:")
  })

  it("filters by POPULATION_ASSOCIATION edge type and the RWE source", async () => {
    const { GET } = await import("@/app/api/graph/outcomes/route")
    await GET(buildRequest("?intervention=rapa&biomarker=crp"))
    const arg = findManyMock.mock.calls[0][0]
    expect(arg.where.edgeType).toBe("POPULATION_ASSOCIATION")
    expect(arg.where.source).toBe("biozephyra-rwe")
    expect(arg.where.fromNode.label.contains).toBe("rapa")
    expect(arg.where.toNode.label.contains).toBe("crp")
  })

  it("clamps limit to a maximum of 200", async () => {
    const { GET } = await import("@/app/api/graph/outcomes/route")
    await GET(buildRequest("?limit=9999"))
    expect(findManyMock.mock.calls[0][0].take).toBe(200)
  })

  it("returns 500 when the query throws", async () => {
    findManyMock.mockRejectedValue(new Error("db down"))
    const { GET } = await import("@/app/api/graph/outcomes/route")
    expect((await GET(buildRequest())).status).toBe(500)
  })
})
