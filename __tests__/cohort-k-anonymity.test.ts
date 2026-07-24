import { describe, expect, it } from "vitest"

import { MIN_COHORT_K, resolveCohortK } from "@/lib/flywheel/outcome-aggregator"

describe("cohort k-anonymity floor (P1-GOV-013)", () => {
  it("pins the floor at 50", () => {
    expect(MIN_COHORT_K).toBe(50)
  })

  it("floors an unset or below-50 requested k up to 50", () => {
    expect(resolveCohortK(undefined)).toBe(50)
    expect(resolveCohortK(0)).toBe(50)
    expect(resolveCohortK(5)).toBe(50) // the old default — now clamped
    expect(resolveCohortK(49)).toBe(50)
  })

  it("allows a stricter (higher) k than the floor", () => {
    expect(resolveCohortK(50)).toBe(50)
    expect(resolveCohortK(100)).toBe(100)
  })
})
