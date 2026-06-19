import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const requireGdprConsentMock = vi.fn(async () => null)
const deriveTenantMock = vi.fn(async () => ({ tenantId: "default" }))
const logAuditMock = vi.fn()

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }))
vi.mock("@/lib/rate-limit", () => ({ applyRateLimit: applyRateLimitMock }))
vi.mock("@/lib/consent", () => ({ requireGdprConsent: requireGdprConsentMock }))
vi.mock("@/lib/tenancy", () => ({ deriveTenantContextWithValidation: deriveTenantMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const CAUSAL_VC = {
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  type: ["VerifiableCredential", "CausalEffectEstimate"],
  id: "urn:vc:causal-pdf-1",
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
  return new NextRequest("http://localhost:3000/api/wallet/causal/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  getServerSessionMock.mockReset()
  applyRateLimitMock.mockClear()
  applyRateLimitMock.mockImplementation(() => null)
  requireGdprConsentMock.mockReset()
  requireGdprConsentMock.mockResolvedValue(null)
  deriveTenantMock.mockReset()
  deriveTenantMock.mockResolvedValue({ tenantId: "default" })
  logAuditMock.mockReset()
  logAuditMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/wallet/causal/pdf", () => {
  it("rejects unauthenticated callers with 401", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/wallet/causal/pdf/route")
    const res = await POST(buildRequest({ vc: CAUSAL_VC }))
    expect(res.status).toBe(401)
  })

  it("rejects missing vc with 400", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/causal/pdf/route")
    const res = await POST(buildRequest({}))
    expect(res.status).toBe(400)
  })

  it("returns 422 for non-causal VCs", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/causal/pdf/route")
    const otherVc = { ...CAUSAL_VC, type: ["VerifiableCredential", "DigitalTwinForecastReceipt"] }
    const res = await POST(buildRequest({ vc: otherVc }))
    expect(res.status).toBe(422)
    const json = (await res.json()) as { code: string }
    expect(json.code).toBe("not_causal_effect_estimate")
  })

  it("returns a PDF with correct headers and writes an audit row", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/causal/pdf/route")
    const res = await POST(buildRequest({ vc: CAUSAL_VC, generatedAt: "2025-01-01T00:00:00Z" }))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("x-causal-low-evidence")).toBe("false")
    expect(res.headers.get("content-disposition")).toContain("causal-effect-")
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-")
    expect(logAuditMock).toHaveBeenCalledTimes(1)
    expect(logAuditMock.mock.calls[0][0].action).toBe("wallet.causal_effect_pdf_exported")
    expect(logAuditMock.mock.calls[0][0].details.intervention).toBe("rapamycin")
  })

  it("flags low_evidence in headers when CI crosses zero", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/causal/pdf/route")
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
