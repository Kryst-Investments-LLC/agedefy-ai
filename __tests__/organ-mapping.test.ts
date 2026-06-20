import { describe, expect, it } from "vitest"

import {
  normalizeBiomarkerName,
  classifyBiomarker,
  classifyBiomarkers,
  summarizeByOrgan,
  statusColor,
  organLabel,
} from "@/lib/biomarkers/organ-mapping"

describe("organ-mapping", () => {
  describe("normalizeBiomarkerName", () => {
    it("lowercases and strips non-alphanumerics", () => {
      expect(normalizeBiomarkerName("hs-CRP")).toBe("hscrp")
      expect(normalizeBiomarkerName("HbA1c")).toBe("hba1c")
      expect(normalizeBiomarkerName("Vitamin D")).toBe("vitamind")
    })
  })

  describe("classifyBiomarker — reference ranges", () => {
    it("classifies an optimal CRP", () => {
      const c = classifyBiomarker({ name: "CRP", value: 0.5 })!
      expect(c.organ).toBe("cardiovascular")
      expect(c.status).toBe("optimal")
      expect(c.direction).toBe("normal")
      expect(c.severity).toBe(0)
    })

    it("classifies a borderline CRP as high", () => {
      const c = classifyBiomarker({ name: "CRP", value: 2.0 })!
      expect(c.status).toBe("borderline")
      expect(c.direction).toBe("high")
      expect(c.severity).toBeGreaterThan(0)
    })

    it("classifies an out-of-range CRP", () => {
      const c = classifyBiomarker({ name: "CRP", value: 8 })!
      expect(c.status).toBe("out_of_range")
      expect(c.direction).toBe("high")
      expect(c.severity).toBeGreaterThan(0.6)
    })

    it("classifies a low biomarker direction", () => {
      const c = classifyBiomarker({ name: "hemoglobin", value: 8 })!
      expect(c.organ).toBe("hematology")
      expect(c.status).toBe("out_of_range")
      expect(c.direction).toBe("low")
    })

    it("maps HbA1c to metabolic", () => {
      expect(classifyBiomarker({ name: "HbA1c", value: 5.0 })!.organ).toBe("metabolic")
    })

    it("maps ALT to liver", () => {
      expect(classifyBiomarker({ name: "ALT", value: 25 })!.organ).toBe("liver")
    })

    it("maps creatinine to kidney", () => {
      expect(classifyBiomarker({ name: "Creatinine", value: 0.9 })!.organ).toBe("kidney")
    })
  })

  describe("classifyBiomarker — per-user target overrides range", () => {
    it("uses target ±15% as the optimal band", () => {
      // unknown biomarker name but cardio hint + target
      const c = classifyBiomarker({ name: "ApoB", value: 80, target: 80 })!
      expect(c.status).toBe("optimal")
    })

    it("flags borderline when 25% off target", () => {
      const c = classifyBiomarker({ name: "ApoB", value: 100, target: 80 })!
      expect(c.status).toBe("borderline")
      expect(c.direction).toBe("high")
    })
  })

  describe("classifyBiomarker — unmappable", () => {
    it("returns null for a biomarker that maps to no organ", () => {
      expect(classifyBiomarker({ name: "zzz_unknown_marker", value: 1 })).toBeNull()
    })

    it("returns unknown status when organ resolves but no range or target", () => {
      // "blood pressure" hits cardio hint but has no reference range here
      const c = classifyBiomarker({ name: "blood pressure systolic", value: 120 })
      expect(c?.organ).toBe("cardiovascular")
      expect(c?.status).toBe("unknown")
    })
  })

  describe("summarizeByOrgan", () => {
    it("rolls up to worst status per organ and sorts worst-first", () => {
      const classified = classifyBiomarkers([
        { name: "CRP", value: 0.5 },   // cardio optimal
        { name: "LDL", value: 160 },   // cardio out_of_range
        { name: "ALT", value: 25 },    // liver optimal
      ])
      const summary = summarizeByOrgan(classified)
      const cardio = summary.find((s) => s.organ === "cardiovascular")!
      expect(cardio.status).toBe("out_of_range") // worst of optimal + out_of_range
      // worst organ sorts first
      expect(summary[0].organ).toBe("cardiovascular")
      const liver = summary.find((s) => s.organ === "liver")!
      expect(liver.status).toBe("optimal")
    })

    it("returns empty for empty input", () => {
      expect(summarizeByOrgan([])).toEqual([])
    })
  })

  describe("statusColor", () => {
    it("returns distinct colors per status", () => {
      const colors = new Set([
        statusColor("optimal"),
        statusColor("borderline"),
        statusColor("out_of_range"),
        statusColor("unknown"),
      ])
      expect(colors.size).toBe(4)
    })
  })

  describe("organLabel", () => {
    it("labels every organ system", () => {
      expect(organLabel("cardiovascular")).toBe("Cardiovascular")
      expect(organLabel("metabolic")).toBe("Metabolic")
    })
  })
})
