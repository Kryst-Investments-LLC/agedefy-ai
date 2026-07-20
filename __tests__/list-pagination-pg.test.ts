import { afterEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

import { db } from "@/lib/db"
import { GET } from "@/app/api/lab-testing/route"

// End-to-end proof that the PERF-009 pagination helper bounds a real list route
// on Postgres and signals a next page via headers — not just the helper's units.

const PREFIX = "PgPageTest Panel"

function getRequest(query: string) {
  return new NextRequest(`http://localhost:3000/api/lab-testing${query}`, {
    method: "GET",
    headers: { "x-correlation-id": `page-${query}` },
  })
}

describe("list pagination on GET /api/lab-testing (P1-PERF-009)", () => {
  afterEach(async () => {
    await db.labTestPanel.deleteMany({ where: { name: { startsWith: PREFIX } } })
  })

  it("bounds the page and advertises hasMore + next offset", async () => {
    for (let i = 0; i < 3; i++) {
      await db.labTestPanel.create({
        data: {
          name: `${PREFIX} ${i}`,
          category: `zzz-page-${i}`, // sort last so our rows are the page tail, not required for counts
          biomarkers: "CRP, ApoB",
          status: "AVAILABLE",
          priceCents: 1000 + i,
        },
      })
    }

    const res = await GET(getRequest("?limit=2"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2) // clamped to limit even though >=3 available
    expect(res.headers.get("X-Page-Limit")).toBe("2")
    expect(res.headers.get("X-Page-Has-More")).toBe("true")
    expect(res.headers.get("X-Page-Next-Offset")).toBe("2")
  })

  it("returns all rows and hasMore=false when the page is not full", async () => {
    await db.labTestPanel.create({
      data: { name: `${PREFIX} solo`, category: "zzz-solo", biomarkers: "CRP", status: "AVAILABLE", priceCents: 500 },
    })

    const res = await GET(getRequest("?limit=500"))
    const body = await res.json()
    const ours = body.filter((p: { name: string }) => p.name.startsWith(PREFIX))
    expect(ours).toHaveLength(1)
    expect(res.headers.get("X-Page-Has-More")).toBe("false")
    expect(res.headers.get("X-Page-Next-Offset")).toBe("")
  })
})
