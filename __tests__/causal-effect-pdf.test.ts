import { describe, expect, it } from "vitest"

import type { VerifiableCredential } from "@/lib/sidecars"
import { CausalEffectPdfError, renderCausalEffectPDF } from "@/lib/wallet/causal-effect-pdf"

function buildVc(overrides: Partial<VerifiableCredential> = {}): VerifiableCredential {
  const base: VerifiableCredential = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    type: ["VerifiableCredential", "CausalEffectEstimate"],
    id: "urn:vc:causal-pdf-test",
    issuer: "did:web:vc.biozephyra.ai",
    issuanceDate: "2025-01-01T00:00:00Z",
    credentialSubject: {
      id: "user-1",
      payload: {
        intervention: "rapamycin",
        outcome: "hs_crp",
        expected_delta: -0.18,
        ci95: [-0.31, -0.05],
        n_similar_profiles: 1240,
        cohort_source: "uk_biobank",
        identification_strategy: "backdoor",
        model_version: "causal-sidecar@0.2.0",
      },
    },
    proof: { proofValue: "z-test", verificationMethod: "did:web:vc.biozephyra.ai#key-1" },
  }
  return { ...base, ...overrides }
}

describe("renderCausalEffectPDF", () => {
  it("emits a deterministic %PDF byte stream for fixed generatedAt", () => {
    const args = { vc: buildVc(), generatedAt: "2025-01-01T00:00:00Z" }
    const a = renderCausalEffectPDF(args)
    const b = renderCausalEffectPDF(args)
    expect(Buffer.from(a).subarray(0, 5).toString("ascii")).toBe("%PDF-")
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })

  it("includes the strong-evidence summary text and core fields", () => {
    const bytes = renderCausalEffectPDF({ vc: buildVc(), generatedAt: "2025-01-01T00:00:00Z" })
    const txt = new TextDecoder().decode(bytes)
    expect(txt).toContain("Biozephyra Causal Effect Estimate Receipt")
    expect(txt).toContain("rapamycin")
    expect(txt).toContain("uk_biobank")
    expect(txt).toContain("Strong evidence")
    expect(txt).not.toContain("LOW EVIDENCE")
  })

  it("renders the LOW EVIDENCE banner when the CI crosses zero", () => {
    const vc = buildVc({
      credentialSubject: {
        id: "user-1",
        payload: {
          intervention: "metformin",
          outcome: "fasting_glucose",
          expected_delta: -0.05,
          ci95: [-0.12, 0.04],
          n_similar_profiles: 800,
          cohort_source: "all_of_us",
          identification_strategy: "backdoor",
          model_version: "causal-sidecar@0.2.0",
        },
      },
    })
    const bytes = renderCausalEffectPDF({ vc, generatedAt: "2025-01-01T00:00:00Z" })
    const txt = new TextDecoder().decode(bytes)
    expect(txt).toContain("LOW EVIDENCE - clinician review required")
    expect(txt).toContain("CI crosses zero")
  })

  it("throws CausalEffectPdfError for non-causal VCs", () => {
    const vc = buildVc({
      type: ["VerifiableCredential", "DigitalTwinForecastReceipt"],
    })
    expect(() => renderCausalEffectPDF({ vc })).toThrow(CausalEffectPdfError)
  })

  it("escapes non-ASCII recipient text safely", () => {
    const bytes = renderCausalEffectPDF({
      vc: buildVc(),
      recipient: "Dr. Smith (cardiology) — café",
      generatedAt: "2025-01-01T00:00:00Z",
    })
    const txt = new TextDecoder().decode(bytes)
    expect(txt).toContain("Dr. Smith \\(cardiology\\)")
    expect(txt).not.toContain("café")
  })
})
