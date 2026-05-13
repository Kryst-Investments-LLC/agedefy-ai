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

const VC = {
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  type: ["VerifiableCredential", "DigitalTwinForecastReceipt"],
  id: "urn:vc:policy-1",
  issuer: "did:web:vc.agedefy.ai",
  issuanceDate: "2025-01-01T00:00:00Z",
  credentialSubject: {
    id: "user-1",
    payload: {
      simulation_id: "sim-1",
      backend_used: "mechanistic",
      horizon_weeks: 52,
      interventions: [],
      outcome_summaries: [],
    },
  },
  proof: { proofValue: "z-test" },
}

const FORECAST = {
  backend_used: "fallback-exponential" as const,
  trajectories: {
    hs_crp: {
      weekly_means: [1.2, 1.0],
      ci95_low: [1.1, 0.9],
      ci95_high: [1.3, 1.1],
    },
  },
}

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/wallet/digital-twin/policy", {
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
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/wallet/digital-twin/policy", () => {
  it("rejects unauthenticated callers with 401", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/wallet/digital-twin/policy/route")
    const res = await POST(buildRequest({ vc: VC }))
    expect(res.status).toBe(401)
  })

  it("rejects bodies missing the vc field with 400", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/digital-twin/policy/route")
    const res = await POST(buildRequest({}))
    expect(res.status).toBe(400)
  })

  it("derives policy from VC payload backend_used when forecast is omitted", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/digital-twin/policy/route")
    const res = await POST(buildRequest({ vc: VC }))
    expect(res.status).toBe(200)
    expect(res.headers.get("x-display-tier")).toBe("calibrated")
    const json = (await res.json()) as {
      policy: { tier: string; backendUsed: string; badgeLabel: string }
      ui: { banner: string | null; badge: string }
    }
    expect(json.policy.tier).toBe("calibrated")
    expect(json.policy.backendUsed).toBe("mechanistic")
    expect(json.ui.banner).toBeNull()
    expect(json.ui.badge).toBe(json.policy.badgeLabel)
  })

  it("uses the forecast in preference to the VC's embedded fields when both are present", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/digital-twin/policy/route")
    const res = await POST(buildRequest({ vc: VC, forecast: FORECAST }))
    expect(res.status).toBe(200)
    expect(res.headers.get("x-display-tier")).toBe("illustrative")
    const json = (await res.json()) as { ui: { banner: string | null } }
    expect(json.ui.banner).toContain("ILLUSTRATIVE")
  })

  it("flags calibrated-partial when low_confidence_outcomes are present in the VC", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/digital-twin/policy/route")
    const vc = {
      ...VC,
      credentialSubject: {
        ...VC.credentialSubject,
        payload: {
          ...VC.credentialSubject.payload,
          low_confidence_outcomes: ["hs_crp"],
        },
      },
    }
    const res = await POST(buildRequest({ vc }))
    expect(res.headers.get("x-display-tier")).toBe("calibrated-partial")
    const json = (await res.json()) as { ui: { banner: string | null } }
    expect(json.ui.banner).toContain("CALIBRATED (PARTIAL)")
  })
})
