import { afterEach, describe, expect, it, vi } from "vitest"

const { loggerErrorMock } = vi.hoisted(() => ({ loggerErrorMock: vi.fn() }))
vi.mock("@/lib/logger", () => ({
  logger: { error: loggerErrorMock },
}))

import { requireCronAuthorization } from "@/lib/security/cron-auth"

describe("requireCronAuthorization", () => {
  const originalSecret = process.env.CRON_SECRET

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalSecret
    loggerErrorMock.mockReset()
  })

  it("accepts the configured bearer secret", () => {
    process.env.CRON_SECRET = "a-production-length-secret-value-123456"
    const request = new Request("https://example.com/api/cron/job", {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    })
    expect(requireCronAuthorization(request)).toBeNull()
  })

  it("rejects missing and incorrect authorization", async () => {
    process.env.CRON_SECRET = "a-production-length-secret-value-123456"
    for (const authorization of [undefined, "Bearer wrong", "Basic credentials"]) {
      const request = new Request("https://example.com/api/cron/job", {
        headers: authorization ? { authorization } : undefined,
      })
      const response = requireCronAuthorization(request)
      expect(response?.status).toBe(401)
      await expect(response?.json()).resolves.toEqual({ error: "Unauthorized" })
    }
  })

  it("fails closed without disclosing missing server configuration", async () => {
    delete process.env.CRON_SECRET
    const response = requireCronAuthorization(new Request("https://example.com/api/cron/job"))
    expect(response?.status).toBe(401)
    await expect(response?.json()).resolves.toEqual({ error: "Unauthorized" })
    expect(loggerErrorMock).toHaveBeenCalledWith("cron.auth.secret_missing")
  })
})
