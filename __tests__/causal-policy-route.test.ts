import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const requireGdprConsentMock = vi.fn(async () => null)
const deriveTenantMock = vi.fn(async () => ({ tenantId: "default" }))

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/rate-limit", () => ({ applyRateLimit: applyRateLimitMock }))
vi.mock("@/lib/consent", () => ({ requireGdprConsent: requireGdprConsentMock }))
vi.mock("@/lib/tenancy", () => ({
  deriveTenantContextWithValidation: deriveTenantMock,
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const CAUSAL_VC = {
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  type: ["VerifiableCredential", "CausalEffectEstimate"],
  id: "urn:vc:causal-1",
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
  proof: { proofValue: "z-test" },
}

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/wallet/causal/policy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  // Feature is gated behind ENABLE_CAUSAL_SIDECAR (defaults OFF in prod).
  // These tests exercise the enabled-route behavior, so turn it on.
  vi.stubEnv("ENABLE_CAUSAL_SIDECAR", "true")
  getServerSessionMock.mockReset()
  applyRateLimitMock.mockClear()
  applyRateLimitMock.mockImplementation(() => null)
  requireGdprConsentMock.mockReset()
  requireGdprConsentMock.mockResolvedValue(null)
  deriveTenantMock.mockReset()
  deriveTenantMock.mockResolvedValue({ tenantId: "default" })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("POST /api/wallet/causal/policy", () => {
  it("rejects unauthenticated callers with 401", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/wallet/causal/policy/route")
    const res = await POST(buildRequest({ vc: CAUSAL_VC }))
    expect(res.status).toBe(401)
  })

  it("rejects bodies missing the vc field with 400", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/causal/policy/route")
    const res = await POST(buildRequest({}))
    expect(res.status).toBe(400)
  })

  it("returns the causal summary with effect_label and evidence_label", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/causal/policy/route")
    const res = await POST(buildRequest({ vc: CAUSAL_VC }))
    expect(res.status).toBe(200)
    expect(res.headers.get("x-causal-low-evidence")).toBe("false")
    const json = (await res.json()) as {
      summary: {
        intervention: string
        low_evidence: boolean
        effect_label: string
        evidence_label: string
      }
    }
    expect(json.summary.intervention).toBe("rapamycin")
    expect(json.summary.low_evidence).toBe(false)
    expect(json.summary.effect_label).toContain("rapamycin -> hs_crp")
    expect(json.summary.evidence_label).toContain("Strong evidence")
  })

  it("returns 422 with code=not_causal_effect_estimate for non-causal VCs", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/causal/policy/route")
    const otherVc = { ...CAUSAL_VC, type: ["VerifiableCredential", "DigitalTwinForecastReceipt"] }
    const res = await POST(buildRequest({ vc: otherVc }))
    expect(res.status).toBe(422)
    const json = (await res.json()) as { code: string }
    expect(json.code).toBe("not_causal_effect_estimate")
  })

  it("flags low_evidence in the response header when CI crosses zero", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/causal/policy/route")
    const lowEvidenceVc = {
      ...CAUSAL_VC,
      credentialSubject: {
        ...CAUSAL_VC.credentialSubject,
        payload: {
          ...CAUSAL_VC.credentialSubject.payload,
          ci95: [-0.1, 0.05],
        },
      },
    }
    const res = await POST(buildRequest({ vc: lowEvidenceVc }))
    expect(res.status).toBe(200)
    expect(res.headers.get("x-causal-low-evidence")).toBe("true")
  })
})
