import { NextRequest, NextResponse } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const authenticateAPIKeyMock = vi.fn()
const requireScopeMock = vi.fn()
const recordUsageMock = vi.fn(async () => undefined)
const logAuditMock = vi.fn(async () => undefined)
const reportGraphQueryUsageMock = vi.fn(async () => ({ reported: false, reason: "not_configured" }))
const queryRweOutcomesMock = vi.fn()
const signResultSafeMock = vi.fn()

vi.mock("@/lib/api-keys/middleware", () => ({
  authenticateAPIKey: authenticateAPIKeyMock,
  requireScope: requireScopeMock,
}))
vi.mock("@/lib/api-keys/metering", () => ({ recordUsage: recordUsageMock }))
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }))
vi.mock("@/lib/billing/graph-usage-billing", () => ({ reportGraphQueryUsage: reportGraphQueryUsageMock }))
vi.mock("@/lib/provenance/sign-result", () => ({ signResultSafe: signResultSafeMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/knowledge-graph/rwe-outcomes-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/knowledge-graph/rwe-outcomes-query")>()
  return { ...actual, queryRweOutcomes: queryRweOutcomesMock }
})

const CTX = {
  key: { id: "key-1", userId: "u1", tenantId: "default", scopes: ["graph:read"], rateLimitPerMin: 60, sandbox: false },
}

const QUERY_RESULT = {
  outcomes: [
    {
      intervention: { label: "Rapamycin", kind: "compound" },
      outcome: { label: "hs-CRP", kind: "biomarker" },
      effectSize: -0.18,
      effectSizeUnit: "z-score",
      evidenceGrade: "C_LOW",
      confidence: 0.7,
      sampleSize: 120,
      pValue: 0.01,
      period: "2026-Q2",
      claimType: "population_association",
      source: "biozephyra-rwe",
    },
  ],
  count: 1,
  suppressedBelowFloor: 0,
}

function buildRequest(query = "") {
  return new NextRequest(`http://localhost:3000/api/v1/graph/outcomes${query}`, { method: "GET" })
}

beforeEach(() => {
  authenticateAPIKeyMock.mockReset()
  authenticateAPIKeyMock.mockResolvedValue(CTX)
  requireScopeMock.mockReset()
  requireScopeMock.mockReturnValue(null)
  recordUsageMock.mockReset()
  recordUsageMock.mockResolvedValue(undefined)
  logAuditMock.mockReset()
  logAuditMock.mockResolvedValue(undefined)
  reportGraphQueryUsageMock.mockReset()
  reportGraphQueryUsageMock.mockResolvedValue({ reported: false, reason: "not_configured" })
  queryRweOutcomesMock.mockReset()
  queryRweOutcomesMock.mockResolvedValue(QUERY_RESULT)
  signResultSafeMock.mockReset()
  signResultSafeMock.mockResolvedValue({ id: "urn:vc:rwe-1", issuer: "did:web:agedefy.ai", proof: { proofValue: "z", verificationMethod: "k" } })
})

afterEach(() => {
  vi.resetModules()
})

describe("GET /api/v1/graph/outcomes", () => {
  it("returns the auth error response when the API key is invalid", async () => {
    authenticateAPIKeyMock.mockResolvedValue(NextResponse.json({ error: "Invalid" }, { status: 401 }))
    const { GET } = await import("@/app/api/v1/graph/outcomes/route")
    expect((await GET(buildRequest())).status).toBe(401)
  })

  it("returns 403 and meters when the key lacks the graph:read scope", async () => {
    requireScopeMock.mockReturnValue(NextResponse.json({ error: "no scope" }, { status: 403 }))
    const { GET } = await import("@/app/api/v1/graph/outcomes/route")
    const res = await GET(buildRequest())
    expect(res.status).toBe(403)
    expect(recordUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ keyId: "key-1", statusCode: 403 }),
    )
  })

  it("checks for the graph:read scope specifically", async () => {
    const { GET } = await import("@/app/api/v1/graph/outcomes/route")
    await GET(buildRequest())
    expect(requireScopeMock).toHaveBeenCalledWith(CTX, "graph:read")
  })

  it("returns 400 and meters on an invalid minGrade", async () => {
    const { GET } = await import("@/app/api/v1/graph/outcomes/route")
    const res = await GET(buildRequest("?minGrade=NOPE"))
    expect(res.status).toBe(400)
    expect(queryRweOutcomesMock).not.toHaveBeenCalled()
    expect(recordUsageMock).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }))
  })

  it("returns 200 with outcomes and framing", async () => {
    const { GET } = await import("@/app/api/v1/graph/outcomes/route")
    const res = await GET(buildRequest())
    expect(res.status).toBe(200)
    const json = (await res.json()) as Record<string, any>
    expect(json.count).toBe(1)
    expect(json.outcomes[0].intervention.label).toBe("Rapamycin")
    expect(json.framing.notice).toMatch(/not medical advice/i)
  })

  it("meters the successful call with status 200", async () => {
    const { GET } = await import("@/app/api/v1/graph/outcomes/route")
    await GET(buildRequest())
    expect(recordUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ keyId: "key-1", endpoint: "/v1/graph/outcomes", statusCode: 200 }),
    )
  })

  it("audit-logs the query with action graph.query", async () => {
    const { GET } = await import("@/app/api/v1/graph/outcomes/route")
    await GET(buildRequest())
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "graph.query",
        actorUserId: "u1",
        tenantId: "default",
        details: expect.objectContaining({ keyId: "key-1", count: 1 }),
      }),
    )
  })

  it("invokes the billing hook for the query", async () => {
    const { GET } = await import("@/app/api/v1/graph/outcomes/route")
    await GET(buildRequest())
    expect(reportGraphQueryUsageMock).toHaveBeenCalledWith({ keyId: "key-1", units: 1 })
  })

  it("attaches a provenance receipt to the response", async () => {
    const { GET } = await import("@/app/api/v1/graph/outcomes/route")
    const res = await GET(buildRequest())
    const json = (await res.json()) as Record<string, any>
    expect(json.provenance).toMatchObject({ id: "urn:vc:rwe-1" })
    expect(signResultSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({ resultType: "RweOutcomeQuery" }),
    )
  })

  it("never leaks node externalId into the response", async () => {
    const { GET } = await import("@/app/api/v1/graph/outcomes/route")
    const res = await GET(buildRequest())
    const text = JSON.stringify(await res.json())
    expect(text).not.toContain("externalId")
  })

  it("returns 500 and meters when the query throws", async () => {
    queryRweOutcomesMock.mockRejectedValue(new Error("db down"))
    const { GET } = await import("@/app/api/v1/graph/outcomes/route")
    const res = await GET(buildRequest())
    expect(res.status).toBe(500)
    expect(recordUsageMock).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }))
  })
})
