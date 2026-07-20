import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const productFindUniqueMock = vi.fn()
const productUpdateMock = vi.fn()
const auditInTransactionMock = vi.fn()
const transactionMock = vi.fn()

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/security/recent-mfa", () => ({ requireRecentMfa: vi.fn(async () => null) }))
vi.mock("@/lib/audit", () => ({
  logAuditInTransactionOrThrow: auditInTransactionMock,
}))
vi.mock("@/lib/ai/health-guardrail", () => ({
  applyHealthGuardrail: vi.fn(() => ({ blocked: false })),
}))
vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: productFindUniqueMock },
    $transaction: transactionMock,
  },
}))

const product = {
  id: "product_1",
  tenantId: "tenant_1",
  name: "Research product",
  description: "Informational copy",
  ingredients: "[]",
  category: "SUPPLEMENT",
  reviewStatus: "DRAFT",
  lastVerifiedAt: new Date("2026-07-01T00:00:00.000Z"),
  thirdPartyTested: true,
  coaUrl: "https://example.com/coa.pdf",
}

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/admin/products/product_1/review", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("PATCH /api/admin/products/[id]/review", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    productFindUniqueMock.mockReset()
    productUpdateMock.mockReset()
    auditInTransactionMock.mockReset()
    transactionMock.mockReset()
    transactionMock.mockImplementation((callback) => callback({
      product: { update: productUpdateMock },
      auditLog: {},
    }))
  })

  it("rejects non-admin callers before loading a product", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "member_1", role: "MEMBER" } })
    const { PATCH } = await import("@/app/api/admin/products/[id]/review/route")

    const response = await PATCH(request({ status: "IN_REVIEW" }), {
      params: Promise.resolve({ id: "product_1" }),
    })

    expect(response.status).toBe(403)
    expect(productFindUniqueMock).not.toHaveBeenCalled()
  })

  it("requires evidence and provenance before approval", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", role: "ADMIN" } })
    productFindUniqueMock.mockResolvedValue(product)
    const { PATCH } = await import("@/app/api/admin/products/[id]/review/route")

    const response = await PATCH(request({ status: "APPROVED" }), {
      params: Promise.resolve({ id: "product_1" }),
    })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.blockers).toHaveLength(2)
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("updates and writes the audit record in the same transaction", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "admin_1", email: "admin@example.com", role: "ADMIN" },
    })
    productFindUniqueMock.mockResolvedValue(product)
    productUpdateMock.mockResolvedValue({ ...product, reviewStatus: "APPROVED" })
    const { PATCH } = await import("@/app/api/admin/products/[id]/review/route")

    const response = await PATCH(request({
      status: "APPROVED",
      evidenceTier: "CONTROLLED_HUMAN_TRIAL",
      sourceProvenance: [{
        source: "Registry",
        identifier: "study-1",
        retrievedAt: "2026-07-19T00:00:00.000Z",
      }],
    }), { params: Promise.resolve({ id: "product_1" }) })

    expect(response.status).toBe(200)
    expect(transactionMock).toHaveBeenCalledOnce()
    expect(productUpdateMock).toHaveBeenCalledOnce()
    expect(auditInTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({ product: expect.any(Object) }),
      expect.objectContaining({
        tenantId: "tenant_1",
        action: "marketplace.product_reviewed",
        entityId: "product_1",
      }),
    )
  })

  it("does not return a successful mutation when the audit write fails", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", role: "ADMIN" } })
    productFindUniqueMock.mockResolvedValue(product)
    productUpdateMock.mockResolvedValue({ ...product, reviewStatus: "IN_REVIEW" })
    auditInTransactionMock.mockRejectedValue(new Error("audit unavailable"))
    const { PATCH } = await import("@/app/api/admin/products/[id]/review/route")

    await expect(PATCH(request({ status: "IN_REVIEW" }), {
      params: Promise.resolve({ id: "product_1" }),
    })).rejects.toThrow("audit unavailable")

    expect(transactionMock).toHaveBeenCalledOnce()
  })
})
