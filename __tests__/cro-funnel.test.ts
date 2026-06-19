import { describe, it, expect } from "vitest"

import { evaluateCroEligibility, isCroFunnelEligible } from "@/lib/cro/funnel"
import { FEP_TRIAGE_THRESHOLD } from "@/lib/active-learning/pilot-metrics"

describe("evaluateCroEligibility", () => {
  it("rejects a candidate with no triage score", () => {
    const r = evaluateCroEligibility(null)
    expect(r.eligible).toBe(false)
    expect(r.reason).toMatch(/run \/fep-triage/i)
  })

  it("rejects undefined the same as null", () => {
    expect(evaluateCroEligibility(undefined).eligible).toBe(false)
  })

  it(`rejects a score below the threshold (${FEP_TRIAGE_THRESHOLD})`, () => {
    const r = evaluateCroEligibility(FEP_TRIAGE_THRESHOLD - 0.01)
    expect(r.eligible).toBe(false)
    expect(r.reason).toMatch(/below the recommend threshold/i)
  })

  it("accepts a score exactly at the threshold", () => {
    expect(evaluateCroEligibility(FEP_TRIAGE_THRESHOLD).eligible).toBe(true)
  })

  it("accepts a score above the threshold", () => {
    const r = evaluateCroEligibility(0.9)
    expect(r.eligible).toBe(true)
    expect(r.reason).toMatch(/meets the recommend threshold/i)
  })
})

describe("isCroFunnelEligible", () => {
  it("mirrors evaluateCroEligibility.eligible", () => {
    expect(isCroFunnelEligible(0.9)).toBe(true)
    expect(isCroFunnelEligible(0.1)).toBe(false)
    expect(isCroFunnelEligible(null)).toBe(false)
  })
})
