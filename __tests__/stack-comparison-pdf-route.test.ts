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
vi.mock("@/lib/tenancy", () => ({ deriveTenantContextWithValidation: deriveTenantMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const COMPARISON = {
  simulation_id_a: "sim-A",
  simulation_id_b: "sim-B",
  delta_of_deltas: {
    hs_crp: { stack_a_final: 0.95, stack_b_final: 0.80, difference: -0.15, ci95: [-0.25, -0.05] },
  },
}

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/wallet/stack-comparison/pdf", {
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

describe("POST /api/wallet/stack-comparison/pdf", () => {
  it("returns 401 for unauthenticated callers", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/wallet/stack-comparison/pdf/route")
    const res = await POST(buildRequest({ comparison: COMPARISON, backend_used: "statistical" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when the comparison is malformed", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/stack-comparison/pdf/route")
    const res = await POST(buildRequest({ comparison: { simulation_id_a: "x" }, backend_used: "statistical" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when neither policy nor backend_used is provided", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/stack-comparison/pdf/route")
    const res = await POST(buildRequest({ comparison: COMPARISON }))
    expect(res.status).toBe(400)
  })

  it("synthesises a calibrated policy from backend_used and returns a PDF", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/stack-comparison/pdf/route")
    const res = await POST(buildRequest({ comparison: COMPARISON, backend_used: "statistical" }))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("x-display-tier")).toBe("calibrated")
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.slice(0, 8).toString("ascii").startsWith("%PDF-1.4")).toBe(true)
    expect(logAuditMock).toHaveBeenCalledTimes(1)
    expect(logAuditMock.mock.calls[0][0].action).toBe("wallet.stack_comparison_pdf_exported")
  })

  it("downgrades to illustrative when backend_used is fallback-exponential", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/stack-comparison/pdf/route")
    const res = await POST(
      buildRequest({ comparison: COMPARISON, backend_used: "fallback-exponential" }),
    )
    expect(res.headers.get("x-display-tier")).toBe("illustrative")
  })

  it("downgrades to calibrated-partial when low_confidence_outcomes is non-empty", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/stack-comparison/pdf/route")
    const res = await POST(
      buildRequest({
        comparison: COMPARISON,
        backend_used: "statistical",
        low_confidence_outcomes: ["hs_crp"],
      }),
    )
    expect(res.headers.get("x-display-tier")).toBe("calibrated-partial")
  })
})
