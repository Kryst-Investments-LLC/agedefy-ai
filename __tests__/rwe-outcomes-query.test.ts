import { describe, it, expect } from "vitest"
import { KgEvidenceGrade } from "@prisma/client"

import {
  parseRweQueryParams,
  RWE_DEFAULT_LIMIT,
  RWE_MAX_LIMIT,
} from "@/lib/knowledge-graph/rwe-outcomes-query"

function params(qs: string): URLSearchParams {
  return new URL(`http://x/${qs}`).searchParams
}

describe("parseRweQueryParams", () => {
  it("returns defaults for an empty query", () => {
    const r = parseRweQueryParams(params(""))
    expect(r.error).toBeUndefined()
    expect(r.params).toEqual({
      intervention: null,
      biomarker: null,
      minGrade: null,
      limit: RWE_DEFAULT_LIMIT,
    })
  })

  it("trims intervention/biomarker and treats blanks as null", () => {
    const r = parseRweQueryParams(params("?intervention=%20rapa%20&biomarker=%20%20"))
    expect(r.params?.intervention).toBe("rapa")
    expect(r.params?.biomarker).toBeNull()
  })

  it("accepts a valid minGrade", () => {
    const r = parseRweQueryParams(params("?minGrade=C_LOW"))
    expect(r.params?.minGrade).toBe(KgEvidenceGrade.C_LOW)
  })

  it("rejects an invalid minGrade with an error", () => {
    const r = parseRweQueryParams(params("?minGrade=SUPER_HIGH"))
    expect(r.params).toBeUndefined()
    expect(r.error).toMatch(/Invalid minGrade/)
  })

  it(`clamps limit to ${RWE_MAX_LIMIT} max`, () => {
    expect(parseRweQueryParams(params("?limit=9999")).params?.limit).toBe(RWE_MAX_LIMIT)
  })

  it("floors a negative limit to at least 1", () => {
    expect(parseRweQueryParams(params("?limit=-5")).params?.limit).toBe(1)
  })

  it("falls back to default for falsy/non-numeric limit (0, abc)", () => {
    // 0 is falsy → treated as unset → default; non-numeric → default.
    expect(parseRweQueryParams(params("?limit=0")).params?.limit).toBe(RWE_DEFAULT_LIMIT)
    expect(parseRweQueryParams(params("?limit=abc")).params?.limit).toBe(RWE_DEFAULT_LIMIT)
  })
})
