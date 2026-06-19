import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const logAuditMock = vi.fn(async () => undefined)
const trialFindFirstMock = vi.fn()
const periodFindFirstMock = vi.fn()
const periodUpdateMock = vi.fn()
const evaluateTrialMock = vi.fn()
const applyStopDecisionMock = vi.fn()

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/agents/nof1", () => ({
  evaluateTrial: evaluateTrialMock,
  applyStopDecision: applyStopDecisionMock,
}))
vi.mock("@/lib/db", () => ({
  db: {
    nofOneTrial: { findFirst: trialFindFirstMock },
    nofOnePeriod: { findFirst: periodFindFirstMock, update: periodUpdateMock },
  },
}))

const RESEARCHER = { user: { id: "r1", email: "r@example.com", role: "RESEARCHER" } }
const params = Promise.resolve({ id: "t1" })

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/nof1/trials/t1/observations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    periodId: "p1",
    observations: [{ measuredAt: "2026-06-19T10:00:00Z", analyte: "hs_crp", value: 1.2, unit: "mg/L" }],
    ...overrides,
  }
}

beforeEach(() => {
  getServerSessionMock.mockReset()
  getServerSessionMock.mockResolvedValue(RESEARCHER)
  logAuditMock.mockReset()
  logAuditMock.mockResolvedValue(undefined)
  trialFindFirstMock.mockReset()
  trialFindFirstMock.mockResolvedValue({ id: "t1", status: "ACTIVE" })
  periodFindFirstMock.mockReset()
  periodFindFirstMock.mockResolvedValue({ id: "p1", observations: [{ measuredAt: "x", analyte: "hs_crp", value: 1, unit: "mg/L" }] })
  periodUpdateMock.mockReset()
  periodUpdateMock.mockResolvedValue({})
  evaluateTrialMock.mockReset()
  evaluateTrialMock.mockResolvedValue({ decision: "CONTINUE", pBenefit: 0.5, postMean: 0, postSd: 1 })
  applyStopDecisionMock.mockReset()
  applyStopDecisionMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/nof1/trials/[id]/observations", () => {
  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/nof1/trials/[id]/observations/route")
    expect((await POST(buildRequest(validBody()), { params })).status).toBe(401)
  })

  it("returns 403 for non-researcher roles", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "USER" } })
    const { POST } = await import("@/app/api/nof1/trials/[id]/observations/route")
    expect((await POST(buildRequest(validBody()), { params })).status).toBe(403)
  })

  it("returns 400 for an invalid body", async () => {
    const { POST } = await import("@/app/api/nof1/trials/[id]/observations/route")
    expect((await POST(buildRequest({ periodId: "p1", observations: [] }), { params })).status).toBe(400)
  })

  it("returns 404 when the trial is not owned by the user", async () => {
    trialFindFirstMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/nof1/trials/[id]/observations/route")
    expect((await POST(buildRequest(validBody()), { params })).status).toBe(404)
  })

  it("returns 409 when the trial is not ACTIVE", async () => {
    trialFindFirstMock.mockResolvedValue({ id: "t1", status: "DESIGN" })
    const { POST } = await import("@/app/api/nof1/trials/[id]/observations/route")
    expect((await POST(buildRequest(validBody()), { params })).status).toBe(409)
  })

  it("returns 404 when the period does not belong to the trial", async () => {
    periodFindFirstMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/nof1/trials/[id]/observations/route")
    expect((await POST(buildRequest(validBody()), { params })).status).toBe(404)
  })

  it("appends observations to the existing period array", async () => {
    const { POST } = await import("@/app/api/nof1/trials/[id]/observations/route")
    const res = await POST(buildRequest(validBody()), { params })
    expect(res.status).toBe(200)
    const updateArg = periodUpdateMock.mock.calls[0][0]
    expect(updateArg.data.observations).toHaveLength(2) // 1 existing + 1 new
    const json = (await res.json()) as Record<string, any>
    expect(json.observationsAdded).toBe(1)
    expect(json.totalObservations).toBe(2)
    expect(json.framing).toMatch(/not medical advice/i)
  })

  it("runs the stopping rule and auto-applies a stop for benefit", async () => {
    evaluateTrialMock.mockResolvedValue({ decision: "STOP_FOR_BENEFIT", pBenefit: 0.97, postMean: 1.8, postSd: 0.1 })
    const { POST } = await import("@/app/api/nof1/trials/[id]/observations/route")
    const res = await POST(buildRequest(validBody()), { params })
    expect(res.status).toBe(200)
    expect(applyStopDecisionMock).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ decision: "STOP_FOR_BENEFIT" }),
      expect.stringMatching(/Auto-stop/),
    )
  })

  it("does not stop when the decision is CONTINUE", async () => {
    const { POST } = await import("@/app/api/nof1/trials/[id]/observations/route")
    await POST(buildRequest(validBody()), { params })
    expect(applyStopDecisionMock).not.toHaveBeenCalled()
  })

  it("still records observations (200) when stop evaluation throws", async () => {
    evaluateTrialMock.mockRejectedValue(new Error("stats boom"))
    const { POST } = await import("@/app/api/nof1/trials/[id]/observations/route")
    const res = await POST(buildRequest(validBody()), { params })
    expect(res.status).toBe(200)
    expect(periodUpdateMock).toHaveBeenCalled()
    const json = (await res.json()) as Record<string, any>
    expect(json.decision).toBeNull()
  })

  it("audit-logs the observation recording", async () => {
    const { POST } = await import("@/app/api/nof1/trials/[id]/observations/route")
    await POST(buildRequest(validBody()), { params })
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "nof1.observations_recorded", entityType: "NofOneTrial" }),
    )
  })
})
