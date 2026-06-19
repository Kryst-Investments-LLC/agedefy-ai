import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const logAuditMock = vi.fn(async () => undefined)
const candidateFindFirstMock = vi.fn()
const partnerFindFirstMock = vi.fn()
const workOrderCreateMock = vi.fn()

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/db", () => ({
  db: {
    experimentCandidate: { findFirst: candidateFindFirstMock },
    croPartner: { findFirst: partnerFindFirstMock },
    croWorkOrder: { create: workOrderCreateMock },
  },
}))

const RESEARCHER = { user: { id: "r1", email: "r@example.com", role: "RESEARCHER" } }
const USER = { user: { id: "u1", email: "u@example.com", role: "USER" } }

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/experiment/candidates/cand-1/cro-order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: "cand-1" })

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    croPartnerId: "cro-1",
    assayType: "biochemical",
    requestedAssays: [{ name: "IC50_SIRT1" }],
    milestonePlan: [{ name: "kickoff", amountCents: 50000 }],
    quoteCents: 100000,
    ...overrides,
  }
}

beforeEach(() => {
  getServerSessionMock.mockReset()
  getServerSessionMock.mockResolvedValue(RESEARCHER)
  logAuditMock.mockReset()
  logAuditMock.mockResolvedValue(undefined)
  candidateFindFirstMock.mockReset()
  candidateFindFirstMock.mockResolvedValue({ id: "cand-1", fepGateScore: 0.8, displayName: "C1" })
  partnerFindFirstMock.mockReset()
  partnerFindFirstMock.mockResolvedValue({ id: "cro-1", name: "Acme CRO" })
  workOrderCreateMock.mockReset()
  workOrderCreateMock.mockResolvedValue({
    id: "wo-1",
    status: "DRAFT",
    candidateId: "cand-1",
    croPartnerId: "cro-1",
    assayType: "biochemical",
    fepGateScoreAtOrder: 0.8,
    createdAt: new Date(),
  })
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/experiment/candidates/[id]/cro-order", () => {
  it("returns 401 for unauthenticated callers", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/experiment/candidates/[id]/cro-order/route")
    expect((await POST(buildRequest(validBody()), { params })).status).toBe(401)
  })

  it("returns 403 for non-researcher roles", async () => {
    getServerSessionMock.mockResolvedValue(USER)
    const { POST } = await import("@/app/api/experiment/candidates/[id]/cro-order/route")
    expect((await POST(buildRequest(validBody()), { params })).status).toBe(403)
  })

  it("returns 400 for an invalid body", async () => {
    const { POST } = await import("@/app/api/experiment/candidates/[id]/cro-order/route")
    expect((await POST(buildRequest({ assayType: "nope" }), { params })).status).toBe(400)
  })

  it("returns 404 when the candidate does not belong to the user", async () => {
    candidateFindFirstMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/experiment/candidates/[id]/cro-order/route")
    expect((await POST(buildRequest(validBody()), { params })).status).toBe(404)
  })

  it("returns 422 when the candidate is not triage-recommended", async () => {
    candidateFindFirstMock.mockResolvedValue({ id: "cand-1", fepGateScore: 0.1, displayName: "C1" })
    const { POST } = await import("@/app/api/experiment/candidates/[id]/cro-order/route")
    const res = await POST(buildRequest(validBody()), { params })
    expect(res.status).toBe(422)
    const json = (await res.json()) as Record<string, any>
    expect(json.reason).toMatch(/below the recommend threshold/i)
    expect(workOrderCreateMock).not.toHaveBeenCalled()
  })

  it("returns 422 when the candidate has no triage score", async () => {
    candidateFindFirstMock.mockResolvedValue({ id: "cand-1", fepGateScore: null, displayName: "C1" })
    const { POST } = await import("@/app/api/experiment/candidates/[id]/cro-order/route")
    expect((await POST(buildRequest(validBody()), { params })).status).toBe(422)
  })

  it("returns 404 when the CRO partner is missing/inactive", async () => {
    partnerFindFirstMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/experiment/candidates/[id]/cro-order/route")
    expect((await POST(buildRequest(validBody()), { params })).status).toBe(404)
  })

  it("creates a DRAFT order with fepGateScoreAtOrder and an initial status event", async () => {
    const { POST } = await import("@/app/api/experiment/candidates/[id]/cro-order/route")
    const res = await POST(buildRequest(validBody()), { params })
    expect(res.status).toBe(201)
    const json = (await res.json()) as Record<string, any>
    expect(json.order.status).toBe("DRAFT")

    const createArg = workOrderCreateMock.mock.calls[0][0]
    expect(createArg.data.status).toBe("DRAFT")
    expect(createArg.data.fepGateScoreAtOrder).toBe(0.8)
    expect(createArg.data.statusEvents.create.toStatus).toBe("DRAFT")
    expect(createArg.data.candidateId).toBe("cand-1")
    expect(createArg.data.userId).toBe("r1")
  })

  it("audit-logs the work-order creation", async () => {
    const { POST } = await import("@/app/api/experiment/candidates/[id]/cro-order/route")
    await POST(buildRequest(validBody()), { params })
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cro.work_order_created", entityType: "CroWorkOrder" }),
    )
  })

  it("returns 500 on an unexpected DB error", async () => {
    workOrderCreateMock.mockRejectedValue(new Error("db down"))
    const { POST } = await import("@/app/api/experiment/candidates/[id]/cro-order/route")
    expect((await POST(buildRequest(validBody()), { params })).status).toBe(500)
  })
})
