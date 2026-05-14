import { beforeEach, describe, expect, it, vi } from "vitest"

const issueMock = vi.fn()

vi.mock("@/lib/sidecars", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/lib/sidecars")
  return {
    ...actual,
    vcSigner: {
      ...(actual.vcSigner as Record<string, unknown>),
      issue: issueMock,
    },
  }
})

beforeEach(() => {
  issueMock.mockReset()
})

describe("signStackComparison", () => {
  const COMPARISON = {
    simulation_id_a: "sim-a",
    simulation_id_b: "sim-b",
    backend_used: "mechanistic" as const,
    delta_of_deltas: {
      hs_crp: { a_delta: -0.1, b_delta: -0.25, difference: -0.15, ci95_half_width: 0.05 },
      ldl: { a_delta: -0.3, b_delta: -0.6, difference: -0.3, ci95_half_width: 0.1 },
    },
    low_confidence_outcomes: ["hs_crp"],
  }
  const POLICY = {
    tier: "calibrated-partial" as const,
    backendUsed: "mechanistic" as const,
    isIllustrative: false,
    requiresClinicianBanner: false,
    lowConfidenceOutcomes: ["hs_crp"],
    pkpdProfile: "1-cmt" as const,
    badgeLabel: "Calibrated (mechanistic) — 1 outcome low-confidence",
    badgeTooltip: "",
  }

  it("issues a DigitalTwinComparisonReceipt VC with the compact summary payload", async () => {
    issueMock.mockResolvedValue({
      id: "urn:vc:cmp-1",
      issuer: "did:web:vc.agedefy.ai",
      type: ["VerifiableCredential", "DigitalTwinComparisonReceipt"],
      proof: { proofValue: "z" },
    })
    const { signStackComparison } = await import("@/lib/agents/compare-stacks-vc")
    const vc = await signStackComparison({
      userId: "user-1",
      comparison: COMPARISON,
      policy: POLICY,
      stackLabels: { a: "Stack A", b: "Stack B" },
    })
    expect(vc.id).toBe("urn:vc:cmp-1")

    expect(issueMock).toHaveBeenCalledTimes(1)
    const [req] = issueMock.mock.calls[0]
    expect(req.type).toEqual(["AgeDefyRecommendationReceipt", "DigitalTwinComparisonReceipt"])
    const subject = req.credentialSubject
    expect(subject.id).toBe("did:web:agedefy.ai:users:user-1")
    expect(subject.recommendationType).toBe("DigitalTwinComparisonReceipt")
    const payload = subject.payload as Record<string, unknown>
    expect(payload.simulation_id_a).toBe("sim-a")
    expect(payload.simulation_id_b).toBe("sim-b")
    expect(payload.backend_used).toBe("mechanistic")
    expect(payload.display_tier).toBe("calibrated-partial")
    expect(payload.low_confidence_outcomes).toEqual(["hs_crp"])
    expect(Array.isArray(payload.delta_of_deltas_summary)).toBe(true)
    expect((payload.delta_of_deltas_summary as unknown[]).length).toBe(2)
    // Full delta map is hashed into inputs_hash, not embedded in payload.
    expect(payload.delta_of_deltas).toBeUndefined()
    expect(typeof subject.inputs_hash).toBe("string")
    expect(String(subject.inputs_hash)).toMatch(/^sha256:/)
  })

  it("defaults stack labels when omitted", async () => {
    issueMock.mockResolvedValue({
      id: "urn:vc:cmp-2",
      issuer: "did:web:vc.agedefy.ai",
      type: ["VerifiableCredential", "DigitalTwinComparisonReceipt"],
      proof: { proofValue: "z" },
    })
    const { signStackComparison } = await import("@/lib/agents/compare-stacks-vc")
    await signStackComparison({
      userId: "user-1",
      comparison: COMPARISON,
      policy: POLICY,
    })
    const [req] = issueMock.mock.calls[0]
    const payload = req.credentialSubject.payload as Record<string, unknown>
    expect(payload.stack_labels).toEqual({ a: "Stack A", b: "Stack B" })
  })

  it("embeds pkpd_profile and a 2-cmt model_version when policy.pkpdProfile is 2-cmt", async () => {
    issueMock.mockResolvedValue({
      id: "urn:vc:cmp-3",
      issuer: "did:web:vc.agedefy.ai",
      type: ["VerifiableCredential", "DigitalTwinComparisonReceipt"],
      proof: { proofValue: "z" },
    })
    const { signStackComparison } = await import("@/lib/agents/compare-stacks-vc")
    await signStackComparison({
      userId: "user-1",
      comparison: COMPARISON,
      policy: { ...POLICY, pkpdProfile: "2-cmt" as const, lowConfidenceOutcomes: [] },
    })
    const [req] = issueMock.mock.calls[0]
    const payload = req.credentialSubject.payload as Record<string, unknown>
    expect(payload.pkpd_profile).toBe("2-cmt")
    expect(String(payload.model_version)).toContain("pkpd-2cmt")
  })

  it("omits model_version (and keeps pkpd_profile=1-cmt) for 1-compartment runs", async () => {
    issueMock.mockResolvedValue({
      id: "urn:vc:cmp-4",
      issuer: "did:web:vc.agedefy.ai",
      type: ["VerifiableCredential", "DigitalTwinComparisonReceipt"],
      proof: { proofValue: "z" },
    })
    const { signStackComparison } = await import("@/lib/agents/compare-stacks-vc")
    await signStackComparison({
      userId: "user-1",
      comparison: COMPARISON,
      policy: POLICY,
    })
    const [req] = issueMock.mock.calls[0]
    const payload = req.credentialSubject.payload as Record<string, unknown>
    expect(payload.pkpd_profile).toBe("1-cmt")
    expect(payload.model_version).toBeUndefined()
  })

  it("prefers an explicit modelVersion over the synthetic placeholder", async () => {
    issueMock.mockResolvedValue({
      id: "urn:vc:cmp-5",
      issuer: "did:web:vc.agedefy.ai",
      type: ["VerifiableCredential", "DigitalTwinComparisonReceipt"],
      proof: { proofValue: "z" },
    })
    const { signStackComparison } = await import("@/lib/agents/compare-stacks-vc")
    await signStackComparison({
      userId: "user-1",
      comparison: COMPARISON,
      policy: { ...POLICY, pkpdProfile: "2-cmt" as const, lowConfidenceOutcomes: [] },
      // Real sidecar-supplied version (mechanistic-sidecar v0.5.0+).
      modelVersion: "mechanistic-sidecar-pkpd-2cmt@0.5.0",
    })
    const [req] = issueMock.mock.calls[0]
    const payload = req.credentialSubject.payload as Record<string, unknown>
    expect(payload.model_version).toBe("mechanistic-sidecar-pkpd-2cmt@0.5.0")
    expect(payload.pkpd_profile).toBe("2-cmt")
  })
})
