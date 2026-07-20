import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

const headersMock = vi.fn()
const constructEventMock = vi.fn()
const confirmMarketplaceStripeCheckoutSessionMock = vi.fn()
const logAuditMock = vi.fn()
const createReviewItemMock = vi.fn()

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
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    idempotencyRecord: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}))

vi.mock("@/scientist-sponsor-marketplace/backend/services/paymentLifecycleService", () => ({
  confirmMarketplaceStripeCheckoutSession: confirmMarketplaceStripeCheckoutSessionMock,
}))

describe("POST /api/stripe/webhook marketplace checkout", () => {
  beforeEach(() => {
    headersMock.mockReset()
    constructEventMock.mockReset()
    confirmMarketplaceStripeCheckoutSessionMock.mockReset()
    logAuditMock.mockReset()
    createReviewItemMock.mockReset()
    headersMock.mockResolvedValue(new Headers({ "stripe-signature": "sig_test" }))
  })

  it("confirms marketplace checkout sessions through the shared lifecycle service", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: "cs_test_123",
          payment_intent: "pi_test_123",
          metadata: {
            flow: "marketplace-escrow-checkout",
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
    expect(confirmMarketplaceStripeCheckoutSessionMock).toHaveBeenCalledWith({
      checkoutSessionId: "cs_test_123",
      paymentIntentId: "pi_test_123",
      source: "stripe-webhook",
    })
    // Claimed as PENDING, then marked COMPLETED only after side effects succeed.
    expect(db.idempotencyRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING" }) }),
    )
    expect(db.idempotencyRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }),
    )
  })

  it("does NOT complete the delivery when a side effect fails (so Stripe retries)", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_fail",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { id: "cs_fail", payment_intent: "pi_fail", metadata: { flow: "marketplace-escrow-checkout" } } },
    })
    // Simulate a transient failure in the side effect.
    confirmMarketplaceStripeCheckoutSessionMock.mockRejectedValueOnce(new Error("transient db error"))
    ;(db.idempotencyRecord.updateMany as ReturnType<typeof vi.fn>).mockClear()

    const { POST } = await import("@/app/api/stripe/webhook/route")
    const response = await POST(new Request("http://localhost:3000/api/stripe/webhook", { method: "POST", body: "{}" }))

    // 5xx tells Stripe to retry; the record must never be marked COMPLETED.
    expect(response.status).toBe(500)
    const completedCalls = (db.idempotencyRecord.updateMany as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([arg]) => arg?.data?.status === "COMPLETED",
    )
    expect(completedCalls).toHaveLength(0)
  })
})