import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const retrieveCheckoutSessionMock = vi.fn()
const confirmMarketplaceStripeCheckoutSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const logAuditMock = vi.fn()
const executeWithCircuitBreakerMock = vi.fn(async ({ execute }: { execute: () => Promise<unknown> }) => execute())

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: applyRateLimitMock,
}))

vi.mock("@/lib/circuit-breaker", () => ({
  CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {},
  executeWithCircuitBreaker: executeWithCircuitBreakerMock,
}))

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve: retrieveCheckoutSessionMock,
      },
    },
  },
}))

vi.mock("@/scientist-sponsor-marketplace/backend/services/paymentLifecycleService", () => ({
  confirmMarketplaceStripeCheckoutSession: confirmMarketplaceStripeCheckoutSessionMock,
}))

describe("POST /api/scientist-sponsor-marketplace/payments/confirm", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    retrieveCheckoutSessionMock.mockReset()
    confirmMarketplaceStripeCheckoutSessionMock.mockReset()
    applyRateLimitMock.mockReset()
    logAuditMock.mockReset()
    executeWithCircuitBreakerMock.mockClear()
    applyRateLimitMock.mockResolvedValue(null)
  })

  it("returns 401 when there is no authenticated session", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/payments/confirm/route")

    const response = await POST(new NextRequest("http://localhost:3000/api/scientist-sponsor-marketplace/payments/confirm", {
      method: "POST",
      body: JSON.stringify({ sessionId: "cs_test_123" }),
    }))

    expect(response.status).toBe(401)
  })

  it("confirms a matching marketplace checkout session", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1", role: "MEMBER", tenantId: "default" } })
    retrieveCheckoutSessionMock.mockResolvedValue({
      id: "cs_test_123",
      status: "complete",
      payment_intent: "pi_test_123",
      metadata: {
        flow: "marketplace-escrow-checkout",
        userId: "user_1",
      },
    })
    confirmMarketplaceStripeCheckoutSessionMock.mockResolvedValue({
      id: "txn_1",
      dealRoomId: "deal_1",
      status: "AUTHORIZED",
      providerReference: "pi_test_123",
    })

    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/payments/confirm/route")

    const response = await POST(new NextRequest("http://localhost:3000/api/scientist-sponsor-marketplace/payments/confirm", {
      method: "POST",
      body: JSON.stringify({ sessionId: "cs_test_123" }),
    }))

    expect(response.status).toBe(200)
    expect(confirmMarketplaceStripeCheckoutSessionMock).toHaveBeenCalledWith({
      checkoutSessionId: "cs_test_123",
      paymentIntentId: "pi_test_123",
      source: "checkout-success",
    })
    await expect(response.json()).resolves.toEqual({
      id: "txn_1",
      dealRoomId: "deal_1",
      status: "AUTHORIZED",
      providerReference: "pi_test_123",
    })
  })
})