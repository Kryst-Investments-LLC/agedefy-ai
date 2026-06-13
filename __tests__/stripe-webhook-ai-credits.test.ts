import { beforeEach, describe, expect, it, vi } from "vitest"

const headersMock = vi.fn()
const constructEventMock = vi.fn()
const logAuditMock = vi.fn()
const createReviewItemMock = vi.fn()
const billingRecordUpsertMock = vi.fn()
const subscriptionUpsertMock = vi.fn()
const subscriptionUpdateManyMock = vi.fn()

vi.mock("next/headers", () => ({
  headers: headersMock,
}))

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: "whsec_test",
  },
}))

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: constructEventMock,
    },
  },
}))

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
  createReviewItem: createReviewItemMock,
}))

vi.mock("@/lib/db", () => ({
  db: {
    subscription: {
      upsert: subscriptionUpsertMock,
      updateMany: subscriptionUpdateManyMock,
    },
    billingRecord: {
      upsert: billingRecordUpsertMock,
    },
    idempotencyRecord: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock("@/scientist-sponsor-marketplace/backend/services/paymentLifecycleService", () => ({
  confirmMarketplaceStripeCheckoutSession: vi.fn(),
}))

describe("POST /api/stripe/webhook AI credit checkout", () => {
  beforeEach(() => {
    headersMock.mockReset()
    constructEventMock.mockReset()
    logAuditMock.mockReset()
    createReviewItemMock.mockReset()
    billingRecordUpsertMock.mockReset()
    subscriptionUpsertMock.mockReset()
    subscriptionUpdateManyMock.mockReset()
    headersMock.mockResolvedValue(new Headers({ "stripe-signature": "sig_test" }))
  })

  it("persists paid AI credit pack purchases as billing records", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_ai_1",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: "cs_ai_123",
          created: 1_717_171_717,
          payment_intent: "pi_ai_123",
          metadata: {
            flow: "ai-credit-pack",
            userId: "user_1",
            aiCreditPackKey: "growth",
            regionTier: "tier2",
            aiCreditsDelta: "1000",
            priceCents: "4500",
            currency: "USD",
          },
        },
      },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const response = await POST(new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    }))

    expect(response.status).toBe(200)
    expect(billingRecordUpsertMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { stripeCheckoutSessionId: "cs_ai_123" },
      create: expect.objectContaining({
        userId: "user_1",
        status: "PAID",
        aiCreditPackKey: "growth",
        aiCreditsDelta: 1000,
        amountCents: 4500,
        stripeCheckoutSessionId: "cs_ai_123",
        stripePaymentIntentId: "pi_ai_123",
      }),
    }))
  })

  it("persists explicit monthly AI allowance metadata for subscription checkouts", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_sub_1",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: "cs_sub_123",
          subscription: "sub_123",
          metadata: {
            userId: "user_1",
            plan: "Enterprise",
            billingCycle: "custom",
            seatQuantity: "25",
            monthlyAICreditAllowance: "12000",
            priceCents: "150000",
            currency: "USD",
          },
        },
      },
    })

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const response = await POST(new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    }))

    expect(response.status).toBe(200)
    expect(subscriptionUpsertMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { stripeCheckoutSessionId: "cs_sub_123" },
      create: expect.objectContaining({
        userId: "user_1",
        plan: "Enterprise",
        monthlyAICreditAllowance: 12000,
        stripeCheckoutSessionId: "cs_sub_123",
        stripeSubscriptionId: "sub_123",
      }),
    }))
  })
})