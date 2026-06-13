import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const requireGdprConsentMock = vi.fn(async () => null)
const deriveTenantMock = vi.fn(async () => ({ tenantId: "default" }))
const refuteMock = vi.fn()
const logAuditMock = vi.fn(async () => undefined)

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
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }))
vi.mock("@/lib/sidecars", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sidecars")>("@/lib/sidecars")
  return {
    ...actual,
    causalSidecar: { ...actual.causalSidecar, refute: refuteMock },
  }
})

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/agents/causal-inference/refute", {
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
  refuteMock.mockReset()
  logAuditMock.mockReset()
  logAuditMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/agents/causal-inference/refute", () => {
  it("rejects unauthenticated callers with 401", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/causal-inference/refute/route")
    const res = await POST(
      buildRequest({ estimate_id: "est_1", refuter: "placebo_treatment" }),
    )
    expect(res.status).toBe(401)
  })

  it("rejects bodies missing estimate_id with 400", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } })
    const { POST } = await import("@/app/api/agents/causal-inference/refute/route")
    const res = await POST(buildRequest({ refuter: "placebo_treatment" }))
    expect(res.status).toBe(400)
  })

  it("rejects unknown refuters with 400", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } })
    const { POST } = await import("@/app/api/agents/causal-inference/refute/route")
    const res = await POST(
      buildRequest({ estimate_id: "est_1", refuter: "made_up" }),
    )
    expect(res.status).toBe(400)
  })

  it("returns the refute result and writes an audit row with passed flag", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    refuteMock.mockResolvedValue({
      estimate_id: "est_1",
      refuter: "placebo_treatment",
      refuted_estimate: 0.002,
      p_value: 0.81,
      passed: true,
    })
    const { POST } = await import("@/app/api/agents/causal-inference/refute/route")
    const res = await POST(
      buildRequest({ estimate_id: "est_1", refuter: "placebo_treatment" }),
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as Record<string, unknown>
    expect(json.passed).toBe(true)
    expect(json.refuted_estimate).toBe(0.002)
    expect(refuteMock).toHaveBeenCalledWith(
      { estimate_id: "est_1", refuter: "placebo_treatment" },
      undefined,
    )
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "agent.causal_effect_refuted",
        entityId: "est_1",
        details: expect.objectContaining({
          refuter: "placebo_treatment",
          passed: true,
          p_value: 0.81,
        }),
      }),
    )
  })

  it("propagates SidecarError status as the response status", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } })
    const { SidecarError } = await import("@/lib/sidecars")
    refuteMock.mockRejectedValue(new SidecarError("estimate not found", 404, {}))
    const { POST } = await import("@/app/api/agents/causal-inference/refute/route")
    const res = await POST(
      buildRequest({ estimate_id: "missing", refuter: "data_subset_refuter" }),
    )
    expect(res.status).toBe(404)
  })
})
