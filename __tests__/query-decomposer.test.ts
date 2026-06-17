import { describe, expect, it } from "vitest"
import { decomposeQuery } from "@/lib/research/query-decomposer"

describe("decomposeQuery", () => {
  it("returns the original query unchanged in originalQuery", () => {
    const d = decomposeQuery("rapamycin aging")
    expect(d.originalQuery).toBe("rapamycin aging")
  })

  it("identifies a known compound by exact name", () => {
    const d = decomposeQuery("Rapamycin lifespan extension")
    expect(d.compoundIds).toContain("rapamycin")
  })

  it("identifies a compound by alias (NMN)", () => {
    const d = decomposeQuery("NMN supplementation aging")
    expect(d.compoundIds).toContain("nmn")
  })

  it("identifies a compound by alias (Sirolimus)", () => {
    const d = decomposeQuery("Sirolimus mTOR inhibitor")
    expect(d.compoundIds).toContain("rapamycin")
  })

  it("identifies a pathway by name", () => {
    const d = decomposeQuery("mTOR Signaling pathway aging")
    expect(d.pathwayIds).toContain("mtor")
  })

  it("identifies autophagy pathway", () => {
    const d = decomposeQuery("autophagy induction spermidine")
    expect(d.pathwayIds).toContain("autophagy")
  })

  it("extracts RCT study type hint", () => {
    const d = decomposeQuery("rapamycin RCT randomized controlled trial")
    expect(d.studyTypeHints).toContain("RCT")
  })

  it("extracts meta-analysis study type hint", () => {
    const d = decomposeQuery("metformin meta-analysis longevity")
    expect(d.studyTypeHints).toContain("meta-analysis")
  })

  it("extracts clinical trial study type hint", () => {
    const d = decomposeQuery("NMN clinical trial aging")
    expect(d.studyTypeHints).toContain("clinical-trial")
  })

  it("returns empty arrays when no entities are found", () => {
    const d = decomposeQuery("some unrelated query about weather")
    expect(d.compoundIds).toHaveLength(0)
    expect(d.pathwayIds).toHaveLength(0)
    expect(d.studyTypeHints).toHaveLength(0)
  })

  it("identifies multiple compounds in the same query", () => {
    const d = decomposeQuery("fisetin quercetin senolytics aging")
    expect(d.compoundIds).toContain("fisetin")
    expect(d.compoundIds).toContain("quercetin")
  })

  it("cleanQuery normalises known aliases to canonical names", () => {
    const d = decomposeQuery("NMN and NAC supplementation")
    // NMN → Nicotinamide Mononucleotide, NAC → N-Acetylcysteine
    expect(d.cleanQuery).toContain("Nicotinamide Mononucleotide")
    expect(d.cleanQuery).toContain("N-Acetylcysteine")
  })
})
