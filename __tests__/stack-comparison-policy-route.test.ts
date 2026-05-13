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

const COMPARISON = {
  simulation_id_a: "sim-a",
  simulation_id_b: "sim-b",
  delta_of_deltas: {
    hs_crp: { a_delta: -0.1, b_delta: -0.2, difference: -0.1, ci95_half_width: 0.05 },
  },
}

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/wallet/stack-comparison/policy", {
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

describe("POST /api/wallet/stack-comparison/policy", () => {
  it("rejects unauthenticated callers with 401", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/wallet/stack-comparison/policy/route")
    const res = await POST(buildRequest({ comparison: COMPARISON, backend_used: "mechanistic" }))
    expect(res.status).toBe(401)
  })

  it("rejects bodies missing comparison with 400", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/stack-comparison/policy/route")
    const res = await POST(buildRequest({ backend_used: "mechanistic" }))
    expect(res.status).toBe(400)
  })

  it("rejects bodies missing both policy and backend_used with 400", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/stack-comparison/policy/route")
    const res = await POST(buildRequest({ comparison: COMPARISON }))
    expect(res.status).toBe(400)
  })

  it("synthesises calibrated policy from backend_used=mechanistic with no low-confidence outcomes", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/stack-comparison/policy/route")
    const res = await POST(
      buildRequest({ comparison: COMPARISON, backend_used: "mechanistic" }),
    )
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

  it("flags calibrated-partial when low_confidence_outcomes are non-empty", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/stack-comparison/policy/route")
    const res = await POST(
      buildRequest({
        comparison: COMPARISON,
        backend_used: "mechanistic",
        low_confidence_outcomes: ["hs_crp"],
      }),
    )
    expect(res.headers.get("x-display-tier")).toBe("calibrated-partial")
    const json = (await res.json()) as { ui: { banner: string | null } }
    expect(json.ui.banner).toContain("CALIBRATED (PARTIAL)")
  })

  it("flags illustrative when backend_used=fallback-exponential", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/stack-comparison/policy/route")
    const res = await POST(
      buildRequest({ comparison: COMPARISON, backend_used: "fallback-exponential" }),
    )
    expect(res.headers.get("x-display-tier")).toBe("illustrative")
    const json = (await res.json()) as { ui: { banner: string | null } }
    expect(json.ui.banner).toContain("ILLUSTRATIVE")
  })

  it("uses explicit policy in preference to backend_used", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/wallet/stack-comparison/policy/route")
    const explicitPolicy = {
      tier: "illustrative",
      backendUsed: "fallback-exponential",
      isIllustrative: true,
      lowConfidenceOutcomes: [],
      badgeLabel: "Illustrative — not clinical",
    }
    const res = await POST(
      buildRequest({
        comparison: COMPARISON,
        policy: explicitPolicy,
        backend_used: "mechanistic",
      }),
    )
    expect(res.headers.get("x-display-tier")).toBe("illustrative")
  })
})
