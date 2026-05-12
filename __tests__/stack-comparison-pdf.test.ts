import { describe, expect, it } from "vitest"

import type { TwinDisplayPolicy } from "@/lib/agents/twin-display-policy"
import type { CompareStacksResponse } from "@/lib/sidecars"
import { renderStackComparisonPDF } from "@/lib/wallet/stack-comparison-pdf"

const COMPARISON: CompareStacksResponse = {
  simulation_id_a: "sim-A",
  simulation_id_b: "sim-B",
  delta_of_deltas: {
    hs_crp: { stack_a_final: 0.95, stack_b_final: 0.80, difference: -0.15, ci95: [-0.25, -0.05] },
    ldl: { stack_a_final: 110, stack_b_final: 95, difference: -15, ci95: [-22, -8] },
  },
}

const CALIBRATED: TwinDisplayPolicy = {
  tier: "calibrated",
  backendUsed: "statistical",
  isIllustrative: false,
  requiresClinicianBanner: false,
  lowConfidenceOutcomes: [],
  badgeLabel: "Calibrated",
  badgeTooltip: "Backend: statistical.",
}

const ILLUSTRATIVE: TwinDisplayPolicy = {
  tier: "illustrative",
  backendUsed: "fallback-exponential",
  isIllustrative: true,
  requiresClinicianBanner: true,
  lowConfidenceOutcomes: [],
  badgeLabel: "Illustrative - not clinical",
  badgeTooltip: "fallback",
}

const PARTIAL: TwinDisplayPolicy = {
  tier: "calibrated-partial",
  backendUsed: "statistical",
  isIllustrative: false,
  requiresClinicianBanner: true,
  lowConfidenceOutcomes: ["ldl"],
  badgeLabel: "Calibrated - 1 outcome low-confidence",
  badgeTooltip: "Backend: statistical. ldl flagged.",
}

describe("renderStackComparisonPDF", () => {
  it("produces a valid PDF byte stream", () => {
    const bytes = renderStackComparisonPDF({
      comparison: COMPARISON,
      policy: CALIBRATED,
      generatedAt: "2025-01-01T00:00:00Z",
    })
    expect(bytes.byteLength).toBeGreaterThan(800)
    expect(new TextDecoder().decode(bytes.slice(0, 8)).startsWith("%PDF-1.4")).toBe(true)
    expect(new TextDecoder().decode(bytes.slice(-8)).includes("%%EOF")).toBe(true)
  })

  it("omits the banner for fully calibrated comparisons", () => {
    const txt = new TextDecoder().decode(
      renderStackComparisonPDF({
        comparison: COMPARISON,
        policy: CALIBRATED,
        generatedAt: "2025-01-01T00:00:00Z",
      }),
    )
    expect(txt).not.toContain("ILLUSTRATIVE")
    expect(txt).not.toContain("CALIBRATED (partial)")
    expect(txt).toContain("AgeDefy Stack Comparison Report")
  })

  it("renders the red illustrative banner for fallback policy", () => {
    const txt = new TextDecoder().decode(
      renderStackComparisonPDF({
        comparison: COMPARISON,
        policy: ILLUSTRATIVE,
        generatedAt: "2025-01-01T00:00:00Z",
      }),
    )
    expect(txt).toContain("ILLUSTRATIVE - NOT CLINICAL GUIDANCE")
    expect(txt).toContain("0.860 0.160 0.160 rg")
  })

  it("renders the amber calibrated-partial banner when outcomes are low-confidence", () => {
    const txt = new TextDecoder().decode(
      renderStackComparisonPDF({
        comparison: COMPARISON,
        policy: PARTIAL,
        generatedAt: "2025-01-01T00:00:00Z",
      }),
    )
    expect(txt).toContain("CALIBRATED (partial)")
    expect(txt).toContain("0.920 0.620 0.130 rg")
  })

  it("respects custom stack labels and title", () => {
    const txt = new TextDecoder().decode(
      renderStackComparisonPDF({
        comparison: COMPARISON,
        policy: CALIBRATED,
        title: "Rapamycin vs Metformin",
        stackLabels: { a: "Rapa", b: "Metf" },
        generatedAt: "2025-01-01T00:00:00Z",
      }),
    )
    expect(txt).toContain("Rapamycin vs Metformin")
    expect(txt).toContain("Rapa vs Metf")
  })

  it("is deterministic for fixed generatedAt", () => {
    const args = {
      comparison: COMPARISON,
      policy: CALIBRATED,
      generatedAt: "2025-01-01T00:00:00Z",
    }
    const a = renderStackComparisonPDF(args)
    const b = renderStackComparisonPDF(args)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })
})
