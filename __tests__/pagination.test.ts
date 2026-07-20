import { describe, expect, it } from "vitest"

import {
  listPageHeaders,
  overfetchTake,
  parseListPageParams,
  splitOverfetch,
} from "@/lib/http/pagination"

const params = (qs: string) => new URLSearchParams(qs)

describe("parseListPageParams (P1-PERF-009)", () => {
  it("applies defaults when limit/offset are absent", () => {
    expect(parseListPageParams(params(""))).toEqual({ limit: 50, offset: 0 })
    expect(parseListPageParams(params(""), { defaultLimit: 100 })).toEqual({ limit: 100, offset: 0 })
  })

  it("clamps limit to maxLimit so a caller cannot request an unbounded page", () => {
    expect(parseListPageParams(params("limit=100000"), { maxLimit: 500 }).limit).toBe(500)
  })

  it("floors positive values and ignores invalid/negative ones", () => {
    expect(parseListPageParams(params("limit=25.9&offset=10.4"))).toEqual({ limit: 25, offset: 10 })
    expect(parseListPageParams(params("limit=-5&offset=-3"))).toEqual({ limit: 50, offset: 0 })
    expect(parseListPageParams(params("limit=abc"))).toEqual({ limit: 50, offset: 0 })
  })
})

describe("overfetch + hasMore detection", () => {
  it("requests one extra row to detect a next page without a COUNT", () => {
    expect(overfetchTake(50)).toBe(51)
  })

  it("splits the probe row and reports hasMore=true only when it is present", () => {
    const rows = Array.from({ length: 51 }, (_, i) => i)
    const { items, hasMore } = splitOverfetch(rows, 50)
    expect(items).toHaveLength(50)
    expect(hasMore).toBe(true)
  })

  it("reports hasMore=false and returns all rows when under the limit", () => {
    const { items, hasMore } = splitOverfetch([1, 2, 3], 50)
    expect(items).toEqual([1, 2, 3])
    expect(hasMore).toBe(false)
  })
})

describe("listPageHeaders", () => {
  it("advertises the next offset only when there is more", () => {
    expect(listPageHeaders({ limit: 50, offset: 0, hasMore: true })).toMatchObject({
      "X-Page-Limit": "50",
      "X-Page-Offset": "0",
      "X-Page-Has-More": "true",
      "X-Page-Next-Offset": "50",
    })
    expect(listPageHeaders({ limit: 50, offset: 0, hasMore: false })["X-Page-Next-Offset"]).toBe("")
  })
})
