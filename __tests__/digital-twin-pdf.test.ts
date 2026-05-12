import { describe, expect, it } from "vitest"

import { getTwinDisplayPolicy } from "@/lib/agents/twin-display-policy"
import type { VerifiableCredential } from "@/lib/sidecars"
import { renderDigitalTwinForecastPDF } from "@/lib/wallet/digital-twin-pdf"

function buildVc(overrides: Partial<VerifiableCredential> = {}): VerifiableCredential {
  const base: VerifiableCredential = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    type: ["VerifiableCredential", "AgeDefyRecommendationReceipt", "DigitalTwinForecastReceipt"],
    id: "urn:vc:test-1",
    issuer: "did:web:vc.agedefy.ai",
    issuanceDate: "2025-01-01T00:00:00Z",
    credentialSubject: {
      id: "user-123",
      payload: {
        simulation_id: "sim-abc",
        backend_used: "statistical",
        model_version: "mechanistic-sidecar-statistical@0.1.0",
        horizon_weeks: 52,
        fallback_used: false,
        interventions: [
          { intervention_id: "rapamycin", dose: "5mg", schedule: "weekly", start_week: 0, stop_week: 52 },
        ],
        outcome_summaries: [
          {
            outcome: "hs_crp",
            baseline: 1.2,
            final_week_mean: 0.95,
            total_delta: -0.25,
            total_delta_pct: -0.21,
            ci95_final: [0.82, 1.08],
            low_confidence_flag: false,
          },
        ],
      },
    },
    proof: { proofValue: "z-test" },
  }
  return { ...base, ...overrides }
}

function buildForecast(
  backend: "statistical" | "fallback-exponential" = "statistical",
  lowConfidence = false,
) {
  return {
    backend_used: backend,
    trajectories: {
      hs_crp: {
        weeks: [0, 52],
        weekly_means: [1.2, 0.95],
        ci95_low: [1.18, 0.82],
        ci95_high: [1.22, 1.08],
        low_confidence_flag: lowConfidence,
      },
    },
  } as const
}

describe("renderDigitalTwinForecastPDF", () => {
  it("produces a valid PDF byte stream with header and trailer", () => {
    const bytes = renderDigitalTwinForecastPDF({
      vc: buildVc(),
      policy: getTwinDisplayPolicy(buildForecast("statistical", false)),
      generatedAt: "2025-01-01T00:00:00Z",
    })
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.byteLength).toBeGreaterThan(800)
    const head = new TextDecoder().decode(bytes.slice(0, 8))
    expect(head.startsWith("%PDF-1.4")).toBe(true)
    const tail = new TextDecoder().decode(bytes.slice(-8))
    expect(tail.includes("%%EOF")).toBe(true)
  })

  it("omits the banner when the forecast is calibrated and full-confidence", () => {
    const bytes = renderDigitalTwinForecastPDF({
      vc: buildVc(),
      policy: getTwinDisplayPolicy(buildForecast("statistical", false)),
      generatedAt: "2025-01-01T00:00:00Z",
    })
    const txt = new TextDecoder().decode(bytes)
    expect(txt).not.toContain("ILLUSTRATIVE")
    expect(txt).not.toContain("CALIBRATED (partial)")
    expect(txt).toContain("AgeDefy Digital-Twin Forecast Receipt")
  })

  it("renders the red illustrative banner when backend is fallback-exponential", () => {
    const bytes = renderDigitalTwinForecastPDF({
      vc: buildVc(),
      policy: getTwinDisplayPolicy(buildForecast("fallback-exponential", false)),
      generatedAt: "2025-01-01T00:00:00Z",
    })
    const txt = new TextDecoder().decode(bytes)
    expect(txt).toContain("ILLUSTRATIVE - NOT CLINICAL GUIDANCE")
    // banner colour (red): 0.860 0.160 0.160 rg
    expect(txt).toContain("0.860 0.160 0.160 rg")
  })

  it("renders the amber calibrated-partial banner when a low-confidence outcome is present", () => {
    const bytes = renderDigitalTwinForecastPDF({
      vc: buildVc(),
      policy: getTwinDisplayPolicy(buildForecast("statistical", true)),
      generatedAt: "2025-01-01T00:00:00Z",
    })
    const txt = new TextDecoder().decode(bytes)
    expect(txt).toContain("CALIBRATED (partial)")
    expect(txt).toContain("0.920 0.620 0.130 rg")
  })

  it("escapes parentheses and strips non-ASCII text from the recipient line", () => {
    const bytes = renderDigitalTwinForecastPDF({
      vc: buildVc(),
      policy: getTwinDisplayPolicy(buildForecast("statistical", false)),
      recipient: "Dr. Smith (cardiology) — café",
      generatedAt: "2025-01-01T00:00:00Z",
    })
    const txt = new TextDecoder().decode(bytes)
    expect(txt).toContain("Dr. Smith \\(cardiology\\)")
    expect(txt).not.toContain("café")
  })

  it("is deterministic for fixed generatedAt", () => {
    const args = {
      vc: buildVc(),
      policy: getTwinDisplayPolicy(buildForecast("statistical", false)),
      generatedAt: "2025-01-01T00:00:00Z",
    }
    const a = renderDigitalTwinForecastPDF(args)
    const b = renderDigitalTwinForecastPDF(args)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })

  it("derives the policy from the VC payload when none is supplied", async () => {
    const { policyFromVc } = await import("@/lib/wallet/digital-twin-pdf")
    const vc = buildVc({
      credentialSubject: {
        id: "user-123",
        payload: {
          backend_used: "fallback-exponential",
          low_confidence_outcomes: [],
        },
      },
    })
    const policy = policyFromVc(vc)
    expect(policy.tier).toBe("illustrative")

    const bytes = renderDigitalTwinForecastPDF({ vc, generatedAt: "2025-01-01T00:00:00Z" })
    const txt = new TextDecoder().decode(bytes)
    expect(txt).toContain("ILLUSTRATIVE - NOT CLINICAL GUIDANCE")
  })
})
