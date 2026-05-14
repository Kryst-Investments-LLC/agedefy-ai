import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const requireGdprConsentMock = vi.fn(async () => null)
const deriveTenantMock = vi.fn(async () => ({ tenantId: "default" }))
const runCausalInferenceAgentMock = vi.fn()
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
vi.mock("@/lib/agents/causal-inference-agent", () => ({
  runCausalInferenceAgent: runCausalInferenceAgentMock,
}))

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/agents/causal-inference/estimate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const ESTIMATE = {
  intervention: "rapamycin",
  outcome: "hs_crp",
  expected_delta: -0.18,
  ci95: [-0.31, -0.05] as [number, number],
  n_similar_profiles: 1240,
  cohort_source: "uk_biobank" as const,
  identification_strategy: "backdoor",
  model_version: "causal-sidecar@0.2.0",
}

beforeEach(() => {
  getServerSessionMock.mockReset()
  applyRateLimitMock.mockClear()
  applyRateLimitMock.mockImplementation(() => null)
  requireGdprConsentMock.mockReset()
  requireGdprConsentMock.mockResolvedValue(null)
  deriveTenantMock.mockReset()
  deriveTenantMock.mockResolvedValue({ tenantId: "default" })
  runCausalInferenceAgentMock.mockReset()
  logAuditMock.mockReset()
  logAuditMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/agents/causal-inference/estimate", () => {
  it("rejects unauthenticated callers with 401", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/causal-inference/estimate/route")
    const res = await POST(
      buildRequest({ exposure: "rapamycin", outcome: "hs_crp", cohort: "uk_biobank" }),
    )
    expect(res.status).toBe(401)
  })

  it("rejects bodies missing exposure/outcome/cohort with 400", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/causal-inference/estimate/route")
    const res = await POST(buildRequest({ exposure: "rapamycin" }))
    expect(res.status).toBe(400)
  })

  it("rejects unknown cohorts with 400", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/causal-inference/estimate/route")
    const res = await POST(
      buildRequest({ exposure: "rapamycin", outcome: "hs_crp", cohort: "made_up" }),
    )
    expect(res.status).toBe(400)
  })

  it("returns the estimate (no VC) and writes an audit row when sign is omitted", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    runCausalInferenceAgentMock.mockResolvedValue({ ...ESTIMATE })
    const { POST } = await import("@/app/api/agents/causal-inference/estimate/route")
    const res = await POST(
      buildRequest({ exposure: "rapamycin", outcome: "hs_crp", cohort: "uk_biobank" }),
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as Record<string, unknown>
    expect(json.expected_delta).toBe(-0.18)
    expect(json.vc).toBeUndefined()
    expect(runCausalInferenceAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        exposure: "rapamycin",
        outcome: "hs_crp",
        cohort: "uk_biobank",
        signWith: undefined,
      }),
    )
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "agent.causal_effect_estimated",
        details: expect.objectContaining({ signed: false, model_version: "causal-sidecar@0.2.0" }),
      }),
    )
  })

  it("threads sign=true into runCausalInferenceAgent.signWith and logs signed=true", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } })
    runCausalInferenceAgentMock.mockResolvedValue({
      ...ESTIMATE,
      vc: { id: "urn:vc:causal-1", proof: { proofValue: "z" } },
    })
    const { POST } = await import("@/app/api/agents/causal-inference/estimate/route")
    const res = await POST(
      buildRequest({
        exposure: "rapamycin",
        outcome: "hs_crp",
        cohort: "uk_biobank",
        sign: true,
      }),
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as Record<string, unknown>
    expect(json.vc).toBeDefined()
    expect(runCausalInferenceAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({ signWith: { userId: "user-1" } }),
    )
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ signed: true }),
      }),
    )
  })
})
