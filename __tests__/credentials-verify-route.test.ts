import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const applyRateLimitMock = vi.fn(() => null)
const verifyMock = vi.fn()
const statusMock = vi.fn()

vi.mock("@/lib/rate-limit", () => ({ applyRateLimit: applyRateLimitMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/sidecars", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sidecars")>("@/lib/sidecars")
  return {
    ...actual,
    vcSigner: {
      ...actual.vcSigner,
      verify: verifyMock,
      status: statusMock,
    },
  }
})

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/credentials/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const VC = {
  id: "urn:vc:test-1",
  issuer: "did:web:vc.agedefy.ai",
  proof: { proofValue: "z-test", verificationMethod: "did:web:vc.agedefy.ai#k1" },
}

beforeEach(() => {
  applyRateLimitMock.mockClear()
  applyRateLimitMock.mockImplementation(() => null)
  verifyMock.mockReset()
  statusMock.mockReset()
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/credentials/verify", () => {
  it("rejects requests without a valid VC body", async () => {
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const r1 = await POST(buildRequest({}))
    expect(r1.status).toBe(400)
    const r2 = await POST(buildRequest({ vc: { id: "x" } }))
    expect(r2.status).toBe(400)
  })

  it("returns valid=true when sidecar reports valid and status reports not revoked", async () => {
    verifyMock.mockResolvedValue({ valid: true, errors: [] })
    statusMock.mockResolvedValue({ id: VC.id, revoked: false })
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: VC }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(true)
    expect(body.revoked).toBe(false)
    expect(body.errors).toEqual([])
    expect(body.revocation_check).toBe("ok")
    expect(body.id).toBe(VC.id)
  })

  it("forces valid=false when status reports revoked", async () => {
    verifyMock.mockResolvedValue({ valid: true, errors: [] })
    statusMock.mockResolvedValue({ id: VC.id, revoked: true })
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: VC }))
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.revoked).toBe(true)
    expect(body.errors).toContain("revoked")
  })

  it("returns valid=false when sidecar reports cryptographic failure", async () => {
    verifyMock.mockResolvedValue({ valid: false, errors: ["bad-signature"] })
    statusMock.mockResolvedValue({ id: VC.id, revoked: false })
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: VC }))
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.errors).toEqual(["bad-signature"])
  })

  it("marks revocation_check=unavailable when status endpoint fails but still verifies", async () => {
    verifyMock.mockResolvedValue({ valid: true, errors: [] })
    statusMock.mockRejectedValue(new Error("revocation index unreachable"))
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: VC }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.valid).toBe(true)
    expect(body.revocation_check).toBe("unavailable")
  })

  it("propagates sidecar errors with their status code", async () => {
    const { SidecarError } = await import("@/lib/sidecars")
    verifyMock.mockRejectedValue(new SidecarError("issuer offline", 503, {}))
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: VC }))
    expect(res.status).toBe(503)
  })

  it("returns display_policy=null for non-DigitalTwinForecastReceipt VCs", async () => {
    verifyMock.mockResolvedValue({ valid: true, errors: [] })
    statusMock.mockResolvedValue({ id: VC.id, revoked: false })
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: VC }))
    const body = await res.json()
    expect(body.display_policy).toBeNull()
  })

  it("derives display_policy from a DigitalTwinForecastReceipt's embedded fields", async () => {
    verifyMock.mockResolvedValue({ valid: true, errors: [] })
    statusMock.mockResolvedValue({ id: VC.id, revoked: false })
    const twinVc = {
      ...VC,
      id: "urn:vc:twin-1",
      type: ["VerifiableCredential", "DigitalTwinForecastReceipt"],
      credentialSubject: {
        id: "user-1",
        payload: {
          backend_used: "mechanistic",
          low_confidence_outcomes: ["hs_crp"],
        },
      },
    }
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: twinVc }))
    const body = await res.json()
    expect(body.display_policy).not.toBeNull()
    expect(body.display_policy.tier).toBe("calibrated-partial")
    expect(body.display_policy.backendUsed).toBe("mechanistic")
    expect(body.display_policy.lowConfidenceOutcomes).toEqual(["hs_crp"])
    expect(body.display_ui).toEqual({
      banner:
        "CALIBRATED (PARTIAL) - some outcomes are low-confidence; review before clinical use",
      badge: body.display_policy.badgeLabel,
      pkpdProfile: "1-cmt",
    })
  })

  it("returns display_ui=null when display_policy is null", async () => {
    verifyMock.mockResolvedValue({ valid: true, errors: [] })
    statusMock.mockResolvedValue({ id: VC.id, revoked: false })
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: VC }))
    const body = await res.json()
    expect(body.display_policy).toBeNull()
    expect(body.display_ui).toBeNull()
  })

  it("derives display_policy from DigitalTwinComparisonReceipt VCs", async () => {
    verifyMock.mockResolvedValue({ valid: true, errors: [] })
    statusMock.mockResolvedValue({ id: VC.id, revoked: false })
    const cmpVc = {
      ...VC,
      id: "urn:vc:cmp-1",
      type: ["VerifiableCredential", "DigitalTwinComparisonReceipt"],
      credentialSubject: {
        id: "user-1",
        payload: {
          backend_used: "fallback-exponential",
          low_confidence_outcomes: [],
        },
      },
    }
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: cmpVc }))
    const body = await res.json()
    expect(body.display_policy).not.toBeNull()
    expect(body.display_policy.tier).toBe("illustrative")
    expect(body.display_ui.banner).toContain("ILLUSTRATIVE")
  })

  it("surfaces display_ui.pkpdProfile=2-cmt for v0.4.0 mechanistic-sidecar VCs", async () => {
    verifyMock.mockResolvedValue({ valid: true, errors: [] })
    statusMock.mockResolvedValue({ id: VC.id, revoked: false })
    const twinVc = {
      ...VC,
      id: "urn:vc:twin-pkpd",
      type: ["VerifiableCredential", "DigitalTwinForecastReceipt"],
      credentialSubject: {
        id: "user-1",
        payload: {
          backend_used: "mechanistic",
          model_version: "mechanistic-sidecar-pkpd-2cmt@0.4.0",
          low_confidence_outcomes: [],
        },
      },
    }
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: twinVc }))
    const body = await res.json()
    expect(body.display_policy.pkpdProfile).toBe("2-cmt")
    expect(body.display_ui.pkpdProfile).toBe("2-cmt")
    expect(body.display_ui.badge).toContain("2-compartment PK/PD")
  })

  it("surfaces display_ui.pkpdProfile=2-cmt for DigitalTwinComparisonReceipt VCs", async () => {
    verifyMock.mockResolvedValue({ valid: true, errors: [] })
    statusMock.mockResolvedValue({ id: VC.id, revoked: false })
    const cmpVc = {
      ...VC,
      id: "urn:vc:cmp-pkpd",
      type: ["VerifiableCredential", "DigitalTwinComparisonReceipt"],
      credentialSubject: {
        id: "user-1",
        payload: {
          backend_used: "mechanistic",
          model_version: "mechanistic-sidecar-pkpd-2cmt@compare-stacks",
          pkpd_profile: "2-cmt",
          low_confidence_outcomes: [],
        },
      },
    }
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: cmpVc }))
    const body = await res.json()
    expect(body.display_policy.pkpdProfile).toBe("2-cmt")
    expect(body.display_ui.pkpdProfile).toBe("2-cmt")
    expect(body.display_ui.badge).toContain("2-compartment PK/PD")
  })

  it("surfaces causal_summary for CausalEffectEstimate VCs", async () => {
    verifyMock.mockResolvedValue({ valid: true, errors: [] })
    statusMock.mockResolvedValue({ id: VC.id, revoked: false })
    const causalVc = {
      ...VC,
      id: "urn:vc:causal-1",
      type: ["VerifiableCredential", "CausalEffectEstimate"],
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
    }
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: causalVc }))
    const body = await res.json()
    expect(body.display_policy).toBeNull()
    expect(body.causal_summary).toEqual({
      intervention: "rapamycin",
      outcome: "hs_crp",
      expected_delta: -0.18,
      ci95: [-0.31, -0.05],
      cohort_source: "uk_biobank",
      identification_strategy: "backdoor",
      n_similar_profiles: 1240,
      model_version: "causal-sidecar@0.2.0",
      low_evidence: false,
      effect_label: "rapamycin -> hs_crp: -0.180 (95% CI -0.310 to -0.050)",
      evidence_label: "Strong evidence (uk_biobank, n=1240)",
    })
  })

  it("flags low_evidence=true when the CI crosses zero or n is small", async () => {
    verifyMock.mockResolvedValue({ valid: true, errors: [] })
    statusMock.mockResolvedValue({ id: VC.id, revoked: false })
    const causalVc = {
      ...VC,
      id: "urn:vc:causal-2",
      type: ["VerifiableCredential", "CausalEffectEstimate"],
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
    }
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: causalVc }))
    const body = await res.json()
    expect(body.causal_summary.low_evidence).toBe(true)
    expect(body.causal_summary.evidence_label).toContain("LOW EVIDENCE")
    expect(body.causal_summary.evidence_label).toContain("CI crosses zero")
  })

  it("returns causal_summary=null for non-causal VCs", async () => {
    verifyMock.mockResolvedValue({ valid: true, errors: [] })
    statusMock.mockResolvedValue({ id: VC.id, revoked: false })
    const { POST } = await import("@/app/api/v1/credentials/verify/route")
    const res = await POST(buildRequest({ vc: VC }))
    const body = await res.json()
    expect(body.causal_summary).toBeNull()
  })
})
