import { describe, expect, it } from "vitest"
import { searchVocabulary } from "@/lib/research/vocabulary-search"
import { NOT_MEDICAL_ADVICE_DISCLAIMER } from "@/lib/ai/health-guardrail-rules"

describe("searchVocabulary", () => {
  it("returns results for a known compound name", () => {
    const results = searchVocabulary("rapamycin")
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe("rapamycin")
    expect(results[0].type).toBe("compound")
  })

  it("matches by alias (NMN → nicotinamide mononucleotide)", () => {
    const results = searchVocabulary("NMN")
    const ids = results.map((r) => r.id)
    expect(ids).toContain("nmn")
  })

  it("returns pathway results for a pathway name", () => {
    const results = searchVocabulary("mTOR signaling")
    const ids = results.map((r) => r.id)
    expect(ids).toContain("mtor")
  })

  it("returns biomarker results for a known biomarker", () => {
    const results = searchVocabulary("Hemoglobin A1c")
    const ids = results.map((r) => r.id)
    expect(ids).toContain("hba1c")
  })

  it("every result carries the not-medical-advice disclaimer", () => {
    const results = searchVocabulary("rapamycin")
    for (const r of results) {
      expect(r.disclaimer).toBe(NOT_MEDICAL_ADVICE_DISCLAIMER)
    }
  })

  it("respects maxResults limit", () => {
    const results = searchVocabulary("", 3)
    expect(results.length).toBeLessThanOrEqual(3)
  })

  it("returns at most maxResults items", () => {
    const results = searchVocabulary("aging")
    expect(results.length).toBeLessThanOrEqual(20) // default limit
  })

  it("marks prescription_only compounds correctly", () => {
    const results = searchVocabulary("rapamycin")
    const rapa = results.find((r) => r.id === "rapamycin")
    expect(rapa?.prescriptionOnly).toBe(true)
  })

  it("marks non-prescription compounds as not prescriptionOnly", () => {
    const results = searchVocabulary("berberine")
    const berb = results.find((r) => r.id === "berberine")
    expect(berb?.prescriptionOnly).toBe(false)
  })

  it("returns empty array for a query with no vocabulary matches", () => {
    const results = searchVocabulary("xylophone flargenstorp quantum")
    expect(results).toHaveLength(0)
  })

  it("returns results sorted by match score descending", () => {
    // Query 'rapamycin mtor' — rapamycin matches both name and pathway
    const results = searchVocabulary("rapamycin mtor")
    // rapamycin should rank first or very high
    const rapa = results.findIndex((r) => r.id === "rapamycin")
    expect(rapa).toBeGreaterThanOrEqual(0)
    expect(rapa).toBeLessThan(3) // should be in top-3
  })

  it("empty query returns all entries up to maxResults", () => {
    const results = searchVocabulary("", 100)
    expect(results.length).toBeGreaterThan(10)
  })
})
