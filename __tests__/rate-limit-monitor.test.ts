import { afterEach, describe, expect, it, vi } from "vitest"
import { recordRateLimitBlock, resetRateLimitMonitor } from "@/lib/rate-limit-monitor"

// Mock the audit module to intercept createReviewItem calls
vi.mock("@/lib/audit", () => ({
  createReviewItem: vi.fn().mockResolvedValue({ id: "review-1" }),
}))

// Mock the telemetry counter
vi.mock("@/lib/observability/telemetry", () => ({
  rateLimitAbuseCounter: { add: vi.fn() },
}))

import { createReviewItem } from "@/lib/audit"
import { rateLimitAbuseCounter } from "@/lib/observability/telemetry"

describe("rate-limit-monitor", () => {
  afterEach(() => {
    resetRateLimitMonitor()
    vi.clearAllMocks()
  })

  it("does not flag abuse below threshold", async () => {
    for (let i = 0; i < 5; i++) {
      await recordRateLimitBlock("1.2.3.4", "/api/test")
    }

    expect(rateLimitAbuseCounter.add).not.toHaveBeenCalled()
    expect(createReviewItem).not.toHaveBeenCalled()
  })

  it("flags abuse when threshold is reached", async () => {
    for (let i = 0; i < 10; i++) {
      await recordRateLimitBlock("1.2.3.4", "/api/test")
    }

    expect(rateLimitAbuseCounter.add).toHaveBeenCalledWith(1, {
      ip: "1.2.3.4",
      route: "/api/test",
    })
    expect(createReviewItem).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "rate_limit_abuse",
        severity: "HIGH",
      }),
    )
  })

  it("tracks different keys independently", async () => {
    for (let i = 0; i < 9; i++) {
      await recordRateLimitBlock("1.1.1.1", "/api/a")
    }
    for (let i = 0; i < 9; i++) {
      await recordRateLimitBlock("2.2.2.2", "/api/b")
    }

    // Neither key hit 10 blocks yet
    expect(rateLimitAbuseCounter.add).not.toHaveBeenCalled()
  })

  it("applies review cooldown (does not create duplicate reviews)", async () => {
    // First wave — triggers review
    for (let i = 0; i < 10; i++) {
      await recordRateLimitBlock("5.5.5.5", "/api/spam")
    }
    expect(createReviewItem).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()

    // Second wave immediately after — should NOT create another review
    for (let i = 0; i < 10; i++) {
      await recordRateLimitBlock("5.5.5.5", "/api/spam")
    }
    // Counter still fires but no new ReviewItem
    expect(rateLimitAbuseCounter.add).toHaveBeenCalled()
    expect(createReviewItem).not.toHaveBeenCalled()
  })
})
