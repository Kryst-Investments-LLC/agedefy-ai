import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const hasGdprConsentMock = vi.fn(async () => true)
const logAuditMock = vi.fn(async () => undefined)
const modelFindUniqueMock = vi.fn()
const participationAggregateMock = vi.fn()
const participationCreateMock = vi.fn()
const modelUpdateMock = vi.fn()

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/rate-limit", () => ({ applyRateLimit: applyRateLimitMock }))
vi.mock("@/lib/consent", () => ({ hasGdprConsent: hasGdprConsentMock }))
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }))
vi.mock("@/lib/db", () => ({
  db: {
    federatedModel: { findUnique: modelFindUniqueMock, update: modelUpdateMock },
    fLParticipation: { aggregate: participationAggregateMock, create: participationCreateMock },
  },
}))

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/fl/participate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return { modelId: "m1", round: 1, localSampleSize: 100, localLoss: 0.4, epsilonSpent: 1, ...overrides }
}

beforeEach(() => {
  process.env.ENABLE_FEDERATED_LEARNING = "true"
  getServerSessionMock.mockReset()
  getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
  applyRateLimitMock.mockReset()
  applyRateLimitMock.mockReturnValue(null)
  hasGdprConsentMock.mockReset()
  hasGdprConsentMock.mockResolvedValue(true)
  logAuditMock.mockReset()
  logAuditMock.mockResolvedValue(undefined)
  modelFindUniqueMock.mockReset()
  modelFindUniqueMock.mockResolvedValue({ id: "m1", status: "training" })
  participationAggregateMock.mockReset()
  participationAggregateMock.mockResolvedValue({ _sum: { epsilonSpent: 0 } })
  participationCreateMock.mockReset()
  participationCreateMock.mockResolvedValue({ id: "p1" })
  modelUpdateMock.mockReset()
  modelUpdateMock.mockResolvedValue({})
})

afterEach(() => {
  delete process.env.ENABLE_FEDERATED_LEARNING
  vi.resetModules()
})

describe("POST /api/fl/participate — DP budget enforcement", () => {
  it("returns 404 when the feature flag is off", async () => {
    delete process.env.ENABLE_FEDERATED_LEARNING
    const { POST } = await import("@/app/api/fl/participate/route")
    expect((await POST(buildRequest(validBody()))).status).toBe(404)
  })

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/fl/participate/route")
    expect((await POST(buildRequest(validBody()))).status).toBe(401)
  })

  it("returns 403 without research-usage consent", async () => {
    hasGdprConsentMock.mockResolvedValue(false)
    const { POST } = await import("@/app/api/fl/participate/route")
    expect((await POST(buildRequest(validBody()))).status).toBe(403)
  })

  it("returns 409 when the model is not in training", async () => {
    modelFindUniqueMock.mockResolvedValue({ id: "m1", status: "published" })
    const { POST } = await import("@/app/api/fl/participate/route")
    expect((await POST(buildRequest(validBody()))).status).toBe(409)
  })

  it("records participation within budget (201)", async () => {
    participationAggregateMock.mockResolvedValue({ _sum: { epsilonSpent: 2 } })
    const { POST } = await import("@/app/api/fl/participate/route")
    const res = await POST(buildRequest(validBody({ epsilonSpent: 1 })))
    expect(res.status).toBe(201)
    expect(participationCreateMock).toHaveBeenCalled()
  })

  it("rejects a contribution that would exceed the DP budget (403)", async () => {
    participationAggregateMock.mockResolvedValue({ _sum: { epsilonSpent: 9.5 } })
    const { POST } = await import("@/app/api/fl/participate/route")
    const res = await POST(buildRequest(validBody({ epsilonSpent: 1 }))) // 9.5 + 1 > 10
    expect(res.status).toBe(403)
    const json = (await res.json()) as Record<string, any>
    expect(json.code).toBe("FL_DP_BUDGET_EXCEEDED")
    expect(participationCreateMock).not.toHaveBeenCalled()
  })

  it("skips the budget query when no epsilon is requested", async () => {
    const { POST } = await import("@/app/api/fl/participate/route")
    await POST(buildRequest(validBody({ epsilonSpent: undefined })))
    expect(participationAggregateMock).not.toHaveBeenCalled()
    expect(participationCreateMock).toHaveBeenCalled()
  })

  it("checks cumulative spend for the specific user+model", async () => {
    participationAggregateMock.mockResolvedValue({ _sum: { epsilonSpent: 0 } })
    const { POST } = await import("@/app/api/fl/participate/route")
    await POST(buildRequest(validBody()))
    expect(participationAggregateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", modelId: "m1" }, _sum: { epsilonSpent: true } }),
    )
  })
})
