import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMfaVerifiedAtMock } = vi.hoisted(() => ({ getMfaVerifiedAtMock: vi.fn() }))
vi.mock("@/lib/mfa", () => ({ getMfaVerifiedAt: getMfaVerifiedAtMock }))

import { requireRecentMfa } from "@/lib/security/recent-mfa"

describe("requireRecentMfa", () => {
  const now = new Date("2026-07-19T20:00:00.000Z")

  beforeEach(() => getMfaVerifiedAtMock.mockReset())

  it("accepts a recent server-recorded challenge", async () => {
    getMfaVerifiedAtMock.mockResolvedValue(new Date("2026-07-19T19:55:00.000Z"))
    await expect(requireRecentMfa("user_1", { now })).resolves.toBeNull()
  })

  it.each([null, new Date("2026-07-19T19:49:59.000Z")])(
    "requires a challenge when the marker is missing or stale",
    async (verifiedAt) => {
      getMfaVerifiedAtMock.mockResolvedValue(verifiedAt)
      const response = await requireRecentMfa("user_1", { now })
      expect(response?.status).toBe(428)
      await expect(response?.json()).resolves.toMatchObject({ code: "recent_mfa_required" })
    },
  )

  it("rejects a verification timestamp implausibly in the future", async () => {
    getMfaVerifiedAtMock.mockResolvedValue(new Date("2026-07-19T20:01:00.000Z"))
    expect((await requireRecentMfa("user_1", { now }))?.status).toBe(428)
  })
})
