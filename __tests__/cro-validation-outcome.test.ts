import { describe, it, expect } from "vitest"

import { summarizeValidationOutcome } from "@/lib/cro/validation-outcome"

describe("summarizeValidationOutcome", () => {
  it("returns an empty summary with null hitRate for no results", () => {
    const s = summarizeValidationOutcome([])
    expect(s.total).toBe(0)
    expect(s.showedLabActivity).toBe(false)
    expect(s.hitRate).toBeNull()
  })

  it("counts each flag bucket", () => {
    const s = summarizeValidationOutcome([
      { flag: "active" },
      { flag: "active" },
      { flag: "inactive" },
      { flag: "borderline" },
      { flag: "toxic" },
      { flag: null },
    ])
    expect(s.total).toBe(6)
    expect(s.active).toBe(2)
    expect(s.inactive).toBe(1)
    expect(s.borderline).toBe(1)
    expect(s.toxic).toBe(1)
  })

  it("computes hitRate as active/total", () => {
    expect(summarizeValidationOutcome([{ flag: "active" }, { flag: "inactive" }]).hitRate).toBe(0.5)
  })

  it("flags showedLabActivity only when at least one active result exists", () => {
    expect(summarizeValidationOutcome([{ flag: "inactive" }]).showedLabActivity).toBe(false)
    expect(summarizeValidationOutcome([{ flag: "active" }]).showedLabActivity).toBe(true)
  })

  it("carries an honesty note that does not overclaim validation", () => {
    const s = summarizeValidationOutcome([{ flag: "active" }])
    expect(s.note).toMatch(/not a validated drug, treatment, or therapy/i)
  })
})
