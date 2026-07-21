import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const verifyWebhookSignatureMock = vi.fn(() => true)
const claimWebhookDeliveryMock = vi.fn()
const completeWebhookDeliveryMock = vi.fn()
const failWebhookDeliveryMock = vi.fn()
const upsertMock = vi.fn()

vi.mock("@/lib/wearables/terra-client", () => ({
  verifyWebhookSignature: verifyWebhookSignatureMock,
}))
vi.mock("@/lib/webhook-idempotency", () => ({
  claimWebhookDelivery: claimWebhookDeliveryMock,
  completeWebhookDelivery: completeWebhookDeliveryMock,
  failWebhookDelivery: failWebhookDeliveryMock,
}))
vi.mock("@/lib/db", () => ({
  db: {
    wearableConnection: { upsert: upsertMock, updateMany: vi.fn() },
    partnerDataRecord: { create: vi.fn() },
  },
}))
vi.mock("@/lib/agents/drift-detector", () => ({ detectDrift: vi.fn() }))
vi.mock("@/lib/loop/loop-trigger", () => ({ triggerLoopCycle: vi.fn() }))
vi.mock("@/lib/wearables/biomarker-bridge", () => ({
  promoteWearableMetrics: vi.fn(async () => ({ promoted: 0 })),
}))
vi.mock("@/lib/wearables/normalizer", () => ({ normalizeTerraPayload: vi.fn(() => []) }))

function webhookRequest(body: unknown) {
  return new NextRequest("http://localhost/api/wearables/webhook", {
    method: "POST",
    headers: { "terra-signature": "sig", "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("wearables webhook idempotency (P0-SEC-008)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyWebhookSignatureMock.mockReturnValue(true)
  })

  it("completes the delivery only after a successful event", async () => {
    claimWebhookDeliveryMock.mockResolvedValue({ claimed: true })
    const { POST } = await import("@/app/api/wearables/webhook/route")

    const res = await POST(
      webhookRequest({ type: "auth", user: { user_id: "t1", reference_id: "u1", provider: "OURA" } }),
    )

    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalledOnce()
    expect(completeWebhookDeliveryMock).toHaveBeenCalledOnce()
    expect(failWebhookDeliveryMock).not.toHaveBeenCalled()
  })

  it("skips a duplicate (already-completed) delivery without reprocessing", async () => {
    claimWebhookDeliveryMock.mockResolvedValue({ claimed: false })
    const { POST } = await import("@/app/api/wearables/webhook/route")

    const res = await POST(webhookRequest({ type: "auth", user: { reference_id: "u1" } }))
    const json = await res.json()

    expect(json.duplicate).toBe(true)
    expect(upsertMock).not.toHaveBeenCalled()
    expect(completeWebhookDeliveryMock).not.toHaveBeenCalled()
  })

  it("rejects an invalid/missing signature (fail-closed) before claiming", async () => {
    verifyWebhookSignatureMock.mockReturnValue(false)
    const { POST } = await import("@/app/api/wearables/webhook/route")

    const res = await POST(webhookRequest({ type: "auth" }))

    expect(res.status).toBe(401)
    expect(claimWebhookDeliveryMock).not.toHaveBeenCalled()
  })

  it("leaves the delivery PENDING (does not complete) when a side effect throws", async () => {
    claimWebhookDeliveryMock.mockResolvedValue({ claimed: true })
    upsertMock.mockRejectedValueOnce(new Error("transient db error"))
    const { POST } = await import("@/app/api/wearables/webhook/route")

    const res = await POST(
      webhookRequest({ type: "auth", user: { user_id: "t1", reference_id: "u1", provider: "OURA" } }),
    )

    expect(res.status).toBe(500)
    expect(completeWebhookDeliveryMock).not.toHaveBeenCalled()
    expect(failWebhookDeliveryMock).toHaveBeenCalledOnce()
  })
})
