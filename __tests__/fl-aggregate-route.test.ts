import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const logAuditMock = vi.fn(async () => undefined)
const userFindUniqueMock = vi.fn()
const modelFindUniqueMock = vi.fn()
const modelUpdateMock = vi.fn()
const participationFindManyMock = vi.fn()

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/rate-limit", () => ({ applyRateLimit: applyRateLimitMock }))
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }))
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: userFindUniqueMock },
    federatedModel: { findUnique: modelFindUniqueMock, update: modelUpdateMock },
    fLParticipation: { findMany: participationFindManyMock },
  },
}))

function buildRequest() {
  return new NextRequest("http://localhost:3000/api/fl/models/m1/aggregate", { method: "POST" })
}
const params = Promise.resolve({ id: "m1" })

const THREE_CLIENTS = [
  { localSampleSize: 100, localLoss: 0.2, epsilonSpent: 1 },
  { localSampleSize: 100, localLoss: 0.4, epsilonSpent: 1 },
  { localSampleSize: 200, localLoss: 0.6, epsilonSpent: 2 },
]

beforeEach(() => {
  process.env.ENABLE_FEDERATED_LEARNING = "true"
  getServerSessionMock.mockReset()
  getServerSessionMock.mockResolvedValue({ user: { id: "a1", email: "a@example.com" } })
  applyRateLimitMock.mockReset()
  applyRateLimitMock.mockReturnValue(null)
  logAuditMock.mockReset()
  logAuditMock.mockResolvedValue(undefined)
  userFindUniqueMock.mockReset()
  userFindUniqueMock.mockResolvedValue({ role: "ADMIN" })
  modelFindUniqueMock.mockReset()
  modelFindUniqueMock.mockResolvedValue({ id: "m1", status: "training", roundsCompleted: 2 })
  modelUpdateMock.mockReset()
  modelUpdateMock.mockResolvedValue({ id: "m1", version: 1, status: "published", loss: 0.45, accuracy: null, epsilon: 4, aggregatedFromN: 3, publishedAt: new Date() })
  participationFindManyMock.mockReset()
  participationFindManyMock.mockResolvedValue(THREE_CLIENTS)
})

afterEach(() => {
  delete process.env.ENABLE_FEDERATED_LEARNING
  vi.resetModules()
})

describe("POST /api/fl/models/[id]/aggregate", () => {
  it("returns 404 when the feature flag is off", async () => {
    delete process.env.ENABLE_FEDERATED_LEARNING
    const { POST } = await import("@/app/api/fl/models/[id]/aggregate/route")
    expect((await POST(buildRequest(), { params })).status).toBe(404)
  })

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/fl/models/[id]/aggregate/route")
    expect((await POST(buildRequest(), { params })).status).toBe(401)
  })

  it("returns 403 for non-admin", async () => {
    userFindUniqueMock.mockResolvedValue({ role: "RESEARCHER" })
    const { POST } = await import("@/app/api/fl/models/[id]/aggregate/route")
    expect((await POST(buildRequest(), { params })).status).toBe(403)
  })

  it("returns 404 when the model is missing", async () => {
    modelFindUniqueMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/fl/models/[id]/aggregate/route")
    expect((await POST(buildRequest(), { params })).status).toBe(404)
  })

  it("returns 409 when the model is not training", async () => {
    modelFindUniqueMock.mockResolvedValue({ id: "m1", status: "published", roundsCompleted: 2 })
    const { POST } = await import("@/app/api/fl/models/[id]/aggregate/route")
    expect((await POST(buildRequest(), { params })).status).toBe(409)
  })

  it("returns 409 (does not publish) below the min-client floor", async () => {
    participationFindManyMock.mockResolvedValue(THREE_CLIENTS.slice(0, 2))
    const { POST } = await import("@/app/api/fl/models/[id]/aggregate/route")
    const res = await POST(buildRequest(), { params })
    expect(res.status).toBe(409)
    const json = (await res.json()) as Record<string, any>
    expect(json.contributors).toBe(2)
    expect(modelUpdateMock).not.toHaveBeenCalled()
  })

  it("aggregates the current round and publishes when ready", async () => {
    const { POST } = await import("@/app/api/fl/models/[id]/aggregate/route")
    const res = await POST(buildRequest(), { params })
    expect(res.status).toBe(200)
    // queried the current round (roundsCompleted = 2)
    expect(participationFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { modelId: "m1", round: 2, status: "completed" } }),
    )
    // FedAvg loss = (100*0.2 + 100*0.4 + 200*0.6)/400 = 0.45; epsilon sum = 4
    const updateData = modelUpdateMock.mock.calls[0][0].data
    expect(updateData.loss).toBeCloseTo(0.45, 6)
    expect(updateData.epsilon).toBeCloseTo(4, 6)
    expect(updateData.status).toBe("published")
    expect(updateData.aggregatedFromN).toBe(3)
  })

  it("audit-logs the aggregation", async () => {
    const { POST } = await import("@/app/api/fl/models/[id]/aggregate/route")
    await POST(buildRequest(), { params })
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "fl.model.aggregated", entityType: "FederatedModel" }),
    )
  })

  it("returns 500 on an unexpected DB error", async () => {
    modelUpdateMock.mockRejectedValue(new Error("db down"))
    const { POST } = await import("@/app/api/fl/models/[id]/aggregate/route")
    expect((await POST(buildRequest(), { params })).status).toBe(500)
  })
})
