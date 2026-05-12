import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const logAuditMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const requireGdprConsentMock = vi.fn(async () => null)
const deriveTenantMock = vi.fn(async () => ({ tenantId: "default" }))

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }))
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
  id: "urn:vc:pdf-1",
  issuer: "did:web:vc.agedefy.ai",
  issuanceDate: "2025-01-01T00:00:00Z",
  credentialSubject: {
    id: "user-1",
    payload: {
      simulation_id: "sim-1",
      backend_used: "statistical",
      horizon_weeks: 52,
      interventions: [],
      outcome_summaries: [],
    },
  },
  proof: { proofValue: "z-test" },
}

const FORECAST = {
  backend_used: "statistical" as const,
  trajectories: {
    hs_crp: {
      weekly_means: [1.2, 1.0],
      ci95_low: [1.1, 0.9],
      ci95_high: [1.3, 1.1],
    },
  },
}

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/wallet/digital-twin/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  getServerSessionMock.mockReset()
  logAuditMock.mockReset()
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

describe("POST /api/wallet/digital-twin/pdf", () => {
  it("rejects unauthenticated callers with 401", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/wallet/digital-twin/pdf/route")
    const res = await POST(buildRequest({ vc: VC, forecast: FORECAST }))
    expect(res.status).toBe(401)
  })

  it("rejects bodies missing the vc field with 400", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/digital-twin/pdf/route")
    const res = await POST(buildRequest({ forecast: FORECAST }))
    expect(res.status).toBe(400)
  })

  it("rejects bodies missing the forecast field with 400", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/digital-twin/pdf/route")
    // VC has no embedded display_tier fields (PR #24): we can still derive a
    // policy from `backend_used` so a forecast is no longer strictly required.
    const res = await POST(buildRequest({ vc: VC }))
    expect(res.status).toBe(200)
    expect(res.headers.get("x-display-tier")).toBe("calibrated")
  })

  it("returns a PDF with the display-tier header and an audit entry", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/digital-twin/pdf/route")
    const res = await POST(buildRequest({ vc: VC, forecast: FORECAST }))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("x-display-tier")).toBe("calibrated")
    expect(res.headers.get("content-disposition") ?? "").toContain("digital-twin-forecast-")
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.slice(0, 8).toString("ascii").startsWith("%PDF-1.4")).toBe(true)
    expect(logAuditMock).toHaveBeenCalledTimes(1)
    const entry = logAuditMock.mock.calls[0][0]
    expect(entry.action).toBe("wallet.digital_twin_pdf_exported")
    expect(entry.details.display_tier).toBe("calibrated")
  })

  it("flags illustrative tier for fallback-exponential forecasts", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/digital-twin/pdf/route")
    const res = await POST(
      buildRequest({
        vc: VC,
        forecast: { ...FORECAST, backend_used: "fallback-exponential" },
      }),
    )
    expect(res.headers.get("x-display-tier")).toBe("illustrative")
  })

  it("derives the policy from VC.payload.low_confidence_outcomes when forecast is omitted", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/digital-twin/pdf/route")
    const vcWithLowConfidence = {
      ...VC,
      credentialSubject: {
        ...VC.credentialSubject,
        payload: {
          ...(VC.credentialSubject as { payload: Record<string, unknown> }).payload,
          low_confidence_outcomes: ["hs_crp"],
        },
      },
    }
    const res = await POST(buildRequest({ vc: vcWithLowConfidence }))
    expect(res.headers.get("x-display-tier")).toBe("calibrated-partial")
  })
})
