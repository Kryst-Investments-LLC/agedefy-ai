import { describe, expect, it } from "vitest"

import { isConnectionLimitUnset, parseConnectionLimit } from "@/lib/db-pool"

describe("parseConnectionLimit (P1-PERF-013)", () => {
  it("reads connection_limit from the URL query", () => {
    expect(parseConnectionLimit("postgresql://u:p@h:5432/db?connection_limit=5")).toBe(5)
    expect(parseConnectionLimit("postgresql://u:p@h:5432/db?pool_timeout=10&connection_limit=20")).toBe(20)
  })

  it("returns null when absent, empty, or non-positive", () => {
    expect(parseConnectionLimit("postgresql://u:p@h:5432/db")).toBeNull()
    expect(parseConnectionLimit("postgresql://u:p@h:5432/db?connection_limit=0")).toBeNull()
    expect(parseConnectionLimit(undefined)).toBeNull()
    expect(parseConnectionLimit("")).toBeNull()
  })

  it("isConnectionLimitUnset is the inverse", () => {
    expect(isConnectionLimitUnset("postgresql://u:p@h:5432/db")).toBe(true)
    expect(isConnectionLimitUnset("postgresql://u:p@h:5432/db?connection_limit=5")).toBe(false)
  })
})
