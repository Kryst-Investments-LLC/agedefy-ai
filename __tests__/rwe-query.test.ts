import { describe, it, expect } from "vitest"
import { KgEvidenceGrade } from "@prisma/client"

import {
  gradeMeets,
  shapeRweOutcomes,
  RWE_QUERY_K_FLOOR,
  RWE_QUERY_FRAMING,
  type RweEdgeRow,
} from "@/lib/knowledge-graph/rwe-query"

function makeRow(overrides: Partial<RweEdgeRow> = {}): RweEdgeRow {
  return {
    evidenceGrade: KgEvidenceGrade.C_LOW,
    source: "biozephyra-rwe",
    effectSize: -0.18,
    effectSizeUnit: "z-score",
    confidence: 0.7,
    attributes: { sampleSize: 120, pValue: 0.01, period: "2026-Q2", claimType: "population_association" },
    fromNode: { label: "Rapamycin", kind: "compound", externalId: "bzkg1:abc" },
    toNode: { label: "hs-CRP", kind: "biomarker", externalId: "bzkg1:def" },
    ...overrides,
  }
}

describe("shapeRweOutcomes — k-anon floor (defense-in-depth)", () => {
  it(`drops rows with sampleSize < ${RWE_QUERY_K_FLOOR}`, () => {
    const res = shapeRweOutcomes([makeRow({ attributes: { sampleSize: RWE_QUERY_K_FLOOR - 1 } })])
    expect(res.outcomes).toHaveLength(0)
    expect(res.suppressedBelowFloor).toBe(1)
  })

  it("drops rows with a missing/non-numeric sampleSize", () => {
    const res = shapeRweOutcomes([
      makeRow({ attributes: {} }),
      makeRow({ attributes: { sampleSize: "120" } }),
      makeRow({ attributes: null }),
    ])
    expect(res.outcomes).toHaveLength(0)
    expect(res.suppressedBelowFloor).toBe(3)
  })

  it(`keeps rows at exactly the floor (${RWE_QUERY_K_FLOOR})`, () => {
    const res = shapeRweOutcomes([makeRow({ attributes: { sampleSize: RWE_QUERY_K_FLOOR } })])
    expect(res.outcomes).toHaveLength(1)
    expect(res.suppressedBelowFloor).toBe(0)
  })
})

describe("shapeRweOutcomes — DTO mapping", () => {
  it("maps from/to nodes to intervention/outcome", () => {
    const { outcomes } = shapeRweOutcomes([makeRow()])
    expect(outcomes[0].intervention).toEqual({ label: "Rapamycin", kind: "compound" })
    expect(outcomes[0].outcome).toEqual({ label: "hs-CRP", kind: "biomarker" })
  })

  it("surfaces effect, grade, confidence and pulls sampleSize/pValue/period from attributes", () => {
    const { outcomes } = shapeRweOutcomes([makeRow()])
    const o = outcomes[0]
    expect(o.effectSize).toBe(-0.18)
    expect(o.effectSizeUnit).toBe("z-score")
    expect(o.evidenceGrade).toBe(KgEvidenceGrade.C_LOW)
    expect(o.confidence).toBe(0.7)
    expect(o.sampleSize).toBe(120)
    expect(o.pValue).toBe(0.01)
    expect(o.period).toBe("2026-Q2")
    expect(o.claimType).toBe("population_association")
  })

  it("never leaks node externalId or any user-level field into the DTO", () => {
    const { outcomes } = shapeRweOutcomes([makeRow()])
    const serialized = JSON.stringify(outcomes[0])
    expect(serialized).not.toContain("externalId")
    expect(serialized).not.toContain("bzkg1:")
    expect(serialized).not.toMatch(/userId/i)
  })

  it("tolerates null effect/confidence and missing optional attributes", () => {
    const { outcomes } = shapeRweOutcomes([
      makeRow({ effectSize: null, confidence: null, attributes: { sampleSize: 50 } }),
    ])
    expect(outcomes[0].effectSize).toBeNull()
    expect(outcomes[0].confidence).toBeNull()
    expect(outcomes[0].pValue).toBeNull()
    expect(outcomes[0].period).toBeNull()
  })
})

describe("gradeMeets", () => {
  it("passes when grade exceeds or equals the minimum", () => {
    expect(gradeMeets(KgEvidenceGrade.C_LOW, KgEvidenceGrade.D_VERY_LOW)).toBe(true)
    expect(gradeMeets(KgEvidenceGrade.C_LOW, KgEvidenceGrade.C_LOW)).toBe(true)
  })

  it("fails when grade is below the minimum", () => {
    expect(gradeMeets(KgEvidenceGrade.D_VERY_LOW, KgEvidenceGrade.C_LOW)).toBe(false)
  })
})

describe("RWE_QUERY_FRAMING", () => {
  it("states research-not-medical-advice and association-not-mechanism", () => {
    expect(RWE_QUERY_FRAMING.notice).toMatch(/not medical advice/i)
    expect(RWE_QUERY_FRAMING.notice).toMatch(/not validated mechanisms/i)
    expect(RWE_QUERY_FRAMING.evidence).toMatch(/capped at C_LOW/)
  })
})
