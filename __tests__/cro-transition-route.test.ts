import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const logAuditMock = vi.fn(async () => undefined)
const workOrderFindFirstMock = vi.fn()
const workOrderUpdateMock = vi.fn()
const labResultCountMock = vi.fn()

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/db", () => ({
  db: {
    croWorkOrder: { findFirst: workOrderFindFirstMock, update: workOrderUpdateMock },
    candidateLabResult: { count: labResultCountMock },
  },
}))

const RESEARCHER = { user: { id: "r1", email: "r@example.com", role: "RESEARCHER" } }

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/cro/work-orders/wo-1/transition", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: "wo-1" })

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "wo-1",
    status: "DRAFT",
    candidateId: "cand-1",
    escrowTransactionId: null,
    submissionId: null,
    ...overrides,
  }
}

beforeEach(() => {
  getServerSessionMock.mockReset()
  getServerSessionMock.mockResolvedValue(RESEARCHER)
  logAuditMock.mockReset()
  logAuditMock.mockResolvedValue(undefined)
  workOrderFindFirstMock.mockReset()
  workOrderFindFirstMock.mockResolvedValue(order())
  workOrderUpdateMock.mockReset()
  workOrderUpdateMock.mockResolvedValue({ id: "wo-1", status: "QUOTED", escrowTransactionId: null, submissionId: null, updatedAt: new Date() })
  labResultCountMock.mockReset()
  labResultCountMock.mockResolvedValue(0)
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/cro/work-orders/[id]/transition", () => {
  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/cro/work-orders/[id]/transition/route")
    expect((await POST(buildRequest({ to: "QUOTED" }), { params })).status).toBe(401)
  })

  it("returns 403 for non-researcher roles", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "USER" } })
    const { POST } = await import("@/app/api/cro/work-orders/[id]/transition/route")
    expect((await POST(buildRequest({ to: "QUOTED" }), { params })).status).toBe(403)
  })

  it("returns 400 for an invalid target status", async () => {
    const { POST } = await import("@/app/api/cro/work-orders/[id]/transition/route")
    expect((await POST(buildRequest({ to: "NONSENSE" }), { params })).status).toBe(400)
  })

  it("returns 404 when the order is not owned by the user", async () => {
    workOrderFindFirstMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/cro/work-orders/[id]/transition/route")
    expect((await POST(buildRequest({ to: "QUOTED" }), { params })).status).toBe(404)
  })

  it("returns 409 for an illegal transition (DRAFT→RECONCILED)", async () => {
    const { POST } = await import("@/app/api/cro/work-orders/[id]/transition/route")
    const res = await POST(buildRequest({ to: "RECONCILED" }), { params })
    expect(res.status).toBe(409)
    expect(workOrderUpdateMock).not.toHaveBeenCalled()
  })

  it("advances DRAFT→QUOTED with no extra requirements", async () => {
    const { POST } = await import("@/app/api/cro/work-orders/[id]/transition/route")
    const res = await POST(buildRequest({ to: "QUOTED" }), { params })
    expect(res.status).toBe(200)
    const createEvent = workOrderUpdateMock.mock.calls[0][0].data.statusEvents.create
    expect(createEvent.fromStatus).toBe("DRAFT")
    expect(createEvent.toStatus).toBe("QUOTED")
  })

  it("returns 422 funding QUOTED→FUNDED without an escrow transaction", async () => {
    workOrderFindFirstMock.mockResolvedValue(order({ status: "QUOTED" }))
    const { POST } = await import("@/app/api/cro/work-orders/[id]/transition/route")
    const res = await POST(buildRequest({ to: "FUNDED" }), { params })
    expect(res.status).toBe(422)
    const json = (await res.json()) as Record<string, any>
    expect(json.reason).toMatch(/escrow/i)
  })

  it("funds QUOTED→FUNDED when an escrow transaction is supplied", async () => {
    workOrderFindFirstMock.mockResolvedValue(order({ status: "QUOTED" }))
    workOrderUpdateMock.mockResolvedValue({ id: "wo-1", status: "FUNDED", escrowTransactionId: "tx-1", submissionId: null, updatedAt: new Date() })
    const { POST } = await import("@/app/api/cro/work-orders/[id]/transition/route")
    const res = await POST(buildRequest({ to: "FUNDED", escrowTransactionId: "tx-1" }), { params })
    expect(res.status).toBe(200)
    expect(workOrderUpdateMock.mock.calls[0][0].data.escrowTransactionId).toBe("tx-1")
  })

  it("returns 422 starting FUNDED→IN_PROGRESS without a submission", async () => {
    workOrderFindFirstMock.mockResolvedValue(order({ status: "FUNDED", escrowTransactionId: "tx-1" }))
    const { POST } = await import("@/app/api/cro/work-orders/[id]/transition/route")
    expect((await POST(buildRequest({ to: "IN_PROGRESS" }), { params })).status).toBe(422)
  })

  it("blocks DELIVERED→RECONCILED until reconciled lab results exist (integrity guard)", async () => {
    workOrderFindFirstMock.mockResolvedValue(order({ status: "DELIVERED", escrowTransactionId: "tx-1", submissionId: "sub-1" }))
    labResultCountMock.mockResolvedValue(0)
    const { POST } = await import("@/app/api/cro/work-orders/[id]/transition/route")
    const res = await POST(buildRequest({ to: "RECONCILED" }), { params })
    expect(res.status).toBe(422)
    expect(labResultCountMock).toHaveBeenCalledWith({ where: { candidateId: "cand-1" } })
  })

  it("allows DELIVERED→RECONCILED once reconciled lab results exist", async () => {
    workOrderFindFirstMock.mockResolvedValue(order({ status: "DELIVERED", escrowTransactionId: "tx-1", submissionId: "sub-1" }))
    labResultCountMock.mockResolvedValue(2)
    workOrderUpdateMock.mockResolvedValue({ id: "wo-1", status: "RECONCILED", escrowTransactionId: "tx-1", submissionId: "sub-1", updatedAt: new Date() })
    const { POST } = await import("@/app/api/cro/work-orders/[id]/transition/route")
    const res = await POST(buildRequest({ to: "RECONCILED" }), { params })
    expect(res.status).toBe(200)
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cro.work_order_transitioned" }),
    )
  })

  it("allows cancelling from a non-terminal state", async () => {
    workOrderFindFirstMock.mockResolvedValue(order({ status: "IN_PROGRESS", escrowTransactionId: "tx-1", submissionId: "sub-1" }))
    workOrderUpdateMock.mockResolvedValue({ id: "wo-1", status: "CANCELLED", escrowTransactionId: "tx-1", submissionId: "sub-1", updatedAt: new Date() })
    const { POST } = await import("@/app/api/cro/work-orders/[id]/transition/route")
    expect((await POST(buildRequest({ to: "CANCELLED" }), { params })).status).toBe(200)
  })

  it("returns 500 on an unexpected DB error", async () => {
    workOrderUpdateMock.mockRejectedValue(new Error("db down"))
    const { POST } = await import("@/app/api/cro/work-orders/[id]/transition/route")
    expect((await POST(buildRequest({ to: "QUOTED" }), { params })).status).toBe(500)
  })
})
