import { describe, expect, it, vi } from "vitest"

import { assertSafeOutboundUrl } from "@/lib/security/outbound-url"

describe("assertSafeOutboundUrl", () => {
  it("accepts HTTPS endpoints resolving only to public addresses", async () => {
    const resolver = vi.fn().mockResolvedValue([{ address: "203.0.113.10", family: 4 }])
    await expect(assertSafeOutboundUrl("https://screening.example.com/run", resolver)).resolves.toBeInstanceOf(URL)
  })

  it.each([
    "http://example.com/run",
    "https://localhost/run",
    "https://127.0.0.1/run",
    "https://169.254.169.254/latest/meta-data",
    "https://user:secret@example.com/run",
    "https://[::1]/run",
  ])("rejects unsafe literal endpoint %s", async (url) => {
    await expect(assertSafeOutboundUrl(url)).rejects.toThrow()
  })

  it("rejects public hostnames when any DNS answer is private", async () => {
    const resolver = vi.fn().mockResolvedValue([
      { address: "203.0.113.10", family: 4 },
      { address: "10.0.0.4", family: 4 },
    ])
    await expect(assertSafeOutboundUrl("https://screening.example.com/run", resolver)).rejects.toThrow("non-public")
  })
})
