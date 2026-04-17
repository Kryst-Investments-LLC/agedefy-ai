import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const logAuditMock = vi.fn()
const executeWithCircuitBreakerMock = vi.fn(async ({ execute }: { execute: () => Promise<unknown> }) => execute())
const applyRateLimitMock = vi.fn(async () => null)
const ensureStripeCustomerMock = vi.fn(async () => "cus_test_123")
const checkoutSessionCreateMock = vi.fn(async () => ({
  id: "cs_test_123",
  url: "https://stripe.test/checkout/session",
}))
const executeIdempotentJsonMutationMock = vi.fn(async ({ execute }: { execute: () => Promise<{ status: number; body: unknown }> }) => {
  const result = await execute()
  return Response.json(result.body, { status: result.status })
})

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}))

vi.mock("@/lib/circuit-breaker", () => ({
  CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {},
  executeWithCircuitBreaker: executeWithCircuitBreakerMock,
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(async () => ({
        id: "user_1",
        email: "user@example.com",
        name: "Test User",
        stripeCustomerId: null,
      })),
    },
    subscription: {
      count: vi.fn(async () => 0),
    },
  },
}))

vi.mock("@/lib/env", () => ({
  env: {
    NEXTAUTH_URL: "http://localhost:3000",
  },
}))

vi.mock("@/lib/idempotency", () => ({
  createIdempotencyFingerprint: vi.fn(() => "fingerprint"),
  executeIdempotentJsonMutation: executeIdempotentJsonMutationMock,
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: applyRateLimitMock,
}))

vi.mock("@/lib/stripe", () => ({
  ensureStripeCustomer: ensureStripeCustomerMock,
  stripe: {
    checkout: {
      sessions: {
        create: checkoutSessionCreateMock,
      },
    },
  },
}))

vi.mock("@/lib/tenancy", () => ({
  deriveTenantContextWithValidation: vi.fn(async () => ({ tenantId: "default" })),
}))

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    logAuditMock.mockReset()
    executeWithCircuitBreakerMock.mockClear()
    applyRateLimitMock.mockClear()
    ensureStripeCustomerMock.mockClear()
    checkoutSessionCreateMock.mockClear()
    executeIdempotentJsonMutationMock.mockClear()
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1", email: "user@example.com" } })
  })

  it("creates one-time Stripe payment sessions for AI credit packs", async () => {
    const { POST } = await import("@/app/api/stripe/checkout/route")
    const response = await POST(new Request("http://localhost:3000/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aiCreditPackKey: "starter", regionTier: "tier3" }),
    }))

    expect(response.status).toBe(200)
    expect(checkoutSessionCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment",
      success_url: "http://localhost:3000/account?checkout=success&flow=ai-credits",
      metadata: expect.objectContaining({
        flow: "ai-credit-pack",
        aiCreditPackKey: "starter",
        regionTier: "tier3",
        aiCreditsDelta: "200",
        priceCents: "900",
      }),
      line_items: [expect.objectContaining({
        quantity: 1,
      })],
    }))
  })

  it("stores the explicit monthly AI allowance in subscription checkout metadata", async () => {
    const { POST } = await import("@/app/api/stripe/checkout/route")
    const response = await POST(new Request("http://localhost:3000/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planKey: "core", regionTier: "tier1", billingCycle: "monthly" }),
    }))

    expect(response.status).toBe(200)
    expect(checkoutSessionCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      metadata: expect.objectContaining({
        planKey: "core",
        aiCreditsIncluded: "250",
        monthlyAICreditAllowance: "250",
        seatQuantity: "1",
      }),
      subscription_data: expect.objectContaining({
        metadata: expect.objectContaining({
          monthlyAICreditAllowance: "250",
        }),
      }),
    }))
  })
})