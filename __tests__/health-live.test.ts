import { describe, expect, it, vi } from "vitest"

// The liveness route must NOT touch the DB. Make @/lib/db throw if imported so a
// regression that adds a DB call to the liveness probe fails this test.
vi.mock("@/lib/db", () => {
  throw new Error("liveness probe must not import the database")
})

import { GET } from "@/app/api/health/live/route"

describe("liveness probe (P1-OPS-010)", () => {
  it("returns 200 alive without touching the database", async () => {
    const res = GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("alive")
    expect(typeof body.timestamp).toBe("string")
  })
})
