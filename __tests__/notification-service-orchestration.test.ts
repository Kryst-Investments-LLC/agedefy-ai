import { beforeEach, describe, expect, it, vi } from "vitest"

const createMock = vi.fn()
const enqueueMock = vi.fn()
const infoMock = vi.fn()
const errorMock = vi.fn()

vi.mock("@/scientist-sponsor-marketplace/backend/services/baseCrudService", () => ({
  BaseCrudService: class BaseCrudService {
    create = createMock
  },
}))

vi.mock("@/lib/jobs/queue", () => ({
  enqueueOrchestrationJob: enqueueMock,
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: infoMock,
    error: errorMock,
  },
}))

describe("notifyMarketplaceUser", () => {
  beforeEach(() => {
    createMock.mockReset()
    enqueueMock.mockReset()
    infoMock.mockReset()
    errorMock.mockReset()
  })

  it("queues durable marketplace notification delivery", async () => {
    createMock.mockResolvedValue({ id: "notif_1" })
    enqueueMock.mockResolvedValue({ id: "job_1" })

    const { notifyMarketplaceUser } = await import("@/scientist-sponsor-marketplace/backend/services/notificationService")

    const created = await notifyMarketplaceUser({
      tenantId: "tenant_1",
      recipientUserId: "user_1",
      type: "payout-review-requested",
      title: "Review requested",
      body: "Review this payout.",
      channels: ["in-app", "email"],
    })

    expect(created).toEqual({ id: "notif_1" })
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_1",
      queue: "NOTIFICATION",
      jobType: "notification.marketplace.dispatch",
      dedupeKey: "marketplace-notification:notif_1",
    }))
  })
})