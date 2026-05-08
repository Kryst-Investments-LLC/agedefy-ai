import { NextRequest, NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const blockWriteDuringImpersonationMock = vi.fn()
const logAuditMock = vi.fn()
const applyRateLimitMock = vi.fn()
const deriveTenantContextWithValidationMock = vi.fn()
const subscriptionFindUniqueMock = vi.fn()
const subscriptionUpdateMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/admin/impersonation", () => ({
  blockWriteDuringImpersonation: blockWriteDuringImpersonationMock,
}))

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}))

vi.mock("@/lib/db", () => ({
  db: {
    subscription: {
      findUnique: (...args: unknown[]) => subscriptionFindUniqueMock(...args),
      update: (...args: unknown[]) => subscriptionUpdateMock(...args),
    },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: applyRateLimitMock,
}))

vi.mock("@/lib/tenancy", () => ({
  deriveTenantContextWithValidation: deriveTenantContextWithValidationMock,
}))

vi.mock("@/lib/idempotency", async () => {
  const { NextResponse } = await import("next/server")

  return {
    createIdempotencyFingerprint: vi.fn(() => "test-fingerprint"),
    executeRouteIdempotentJsonMutation: vi.fn(async ({ execute }: { request: Request; execute: () => Promise<{ status: number; body: unknown }> }) => {
      const result = await execute()
      return NextResponse.json(result.body, { status: result.status })
    }),
  }
})

describe("/api/admin/subscriptions/[id]", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    blockWriteDuringImpersonationMock.mockReset()
    logAuditMock.mockReset()
    applyRateLimitMock.mockReset()
    deriveTenantContextWithValidationMock.mockReset()
    subscriptionFindUniqueMock.mockReset()
    subscriptionUpdateMock.mockReset()

    applyRateLimitMock.mockResolvedValue(null)
    blockWriteDuringImpersonationMock.mockReturnValue(null)
    deriveTenantContextWithValidationMock.mockResolvedValue({ tenantId: "tenant_1", source: "session" })
  })

  it("rejects non-admin callers", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1", role: "MEMBER" } })

    const { PATCH } = await import("@/app/api/admin/subscriptions/[id]/route")
    const response = await PATCH(new NextRequest("http://localhost:3000/api/admin/subscriptions/sub_1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "allowance-update-1",
      },
      body: JSON.stringify({ monthlyAICreditAllowance: 7500 }),
    }), { params: Promise.resolve({ id: "sub_1" }) })

    expect(response.status).toBe(403)
    expect(subscriptionFindUniqueMock).not.toHaveBeenCalled()
  })

  it("blocks writes during impersonation", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", role: "ADMIN", tenantId: "tenant_1" } })
    blockWriteDuringImpersonationMock.mockReturnValue(NextResponse.json({ error: "blocked" }, { status: 403 }))

    const { PATCH } = await import("@/app/api/admin/subscriptions/[id]/route")
    const response = await PATCH(new NextRequest("http://localhost:3000/api/admin/subscriptions/sub_1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "allowance-update-2",
      },
      body: JSON.stringify({ monthlyAICreditAllowance: 7500 }),
    }), { params: Promise.resolve({ id: "sub_1" }) })

    expect(response.status).toBe(403)
    expect(subscriptionFindUniqueMock).not.toHaveBeenCalled()
  })

  it("rejects invalid monthly allowance payloads", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", role: "ADMIN", tenantId: "tenant_1" } })

    const { PATCH } = await import("@/app/api/admin/subscriptions/[id]/route")
    const response = await PATCH(new NextRequest("http://localhost:3000/api/admin/subscriptions/sub_1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "allowance-update-3",
      },
      body: JSON.stringify({ monthlyAICreditAllowance: -1 }),
    }), { params: Promise.resolve({ id: "sub_1" }) })

    expect(response.status).toBe(400)
    expect(subscriptionFindUniqueMock).not.toHaveBeenCalled()
  })

  it("rejects non-enterprise subscriptions", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", role: "ADMIN", tenantId: "tenant_1" } })
    subscriptionFindUniqueMock.mockResolvedValue({
      id: "sub_1",
      plan: "plus",
      userId: "user_1",
      monthlyAICreditAllowance: 1500,
    })

    const { PATCH } = await import("@/app/api/admin/subscriptions/[id]/route")
    const response = await PATCH(new NextRequest("http://localhost:3000/api/admin/subscriptions/sub_1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "allowance-update-4",
      },
      body: JSON.stringify({ monthlyAICreditAllowance: 9000 }),
    }), { params: Promise.resolve({ id: "sub_1" }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Only enterprise subscriptions can be edited from this route")
    expect(subscriptionUpdateMock).not.toHaveBeenCalled()
  })

  it("updates enterprise monthly allowance for admins", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "admin_1", email: "admin@example.com", role: "ADMIN", tenantId: "tenant_1" } })
    subscriptionFindUniqueMock.mockResolvedValue({
      id: "sub_1",
      plan: "enterprise",
      userId: "user_1",
      monthlyAICreditAllowance: 5000,
    })
    subscriptionUpdateMock.mockResolvedValue({
      id: "sub_1",
      plan: "enterprise",
      status: "ACTIVE",
      monthlyAICreditAllowance: 9000,
      updatedAt: new Date("2026-04-15T10:00:00.000Z"),
    })

    const { PATCH } = await import("@/app/api/admin/subscriptions/[id]/route")
    const response = await PATCH(new NextRequest("http://localhost:3000/api/admin/subscriptions/sub_1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "allowance-update-5",
      },
      body: JSON.stringify({ monthlyAICreditAllowance: 9000 }),
    }), { params: Promise.resolve({ id: "sub_1" }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.monthlyAICreditAllowance).toBe(9000)
    expect(subscriptionUpdateMock).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: { monthlyAICreditAllowance: 9000 },
      select: {
        id: true,
        plan: true,
        status: true,
        monthlyAICreditAllowance: true,
        updatedAt: true,
      },
    })
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "admin.subscription.allowance.updated",
      entityId: "sub_1",
      details: expect.objectContaining({
        previousMonthlyAICreditAllowance: 5000,
        monthlyAICreditAllowance: 9000,
      }),
    }))
  })
})