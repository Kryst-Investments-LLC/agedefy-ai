import { describe, expect, it, vi } from "vitest"

import { httpRequestDurationHistogram } from "@/lib/observability/telemetry"
import { withHttpMetrics } from "@/lib/observability/with-http-metrics"

describe("withHttpMetrics (P0-OBS-004)", () => {
  it("records duration with route/method/status and returns the handler response", async () => {
    const spy = vi.spyOn(httpRequestDurationHistogram, "record")
    const handler = withHttpMetrics("/api/demo", async (req: Request) => {
      return new Response("ok", { status: 201 })
    })

    const res = await handler(new Request("http://x/api/demo", { method: "POST" }))

    expect(res.status).toBe(201)
    expect(spy).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ route: "/api/demo", method: "POST", http_status_code: 201 }),
    )
    spy.mockRestore()
  })

  it("records a thrown handler as 500 and re-throws", async () => {
    const spy = vi.spyOn(httpRequestDurationHistogram, "record")
    const handler = withHttpMetrics("/api/boom", async (_req: Request) => {
      throw new Error("boom")
    })

    await expect(handler(new Request("http://x/api/boom", { method: "GET" }))).rejects.toThrow("boom")
    expect(spy).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ route: "/api/boom", method: "GET", http_status_code: 500 }),
    )
    spy.mockRestore()
  })
})
