import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const logAuditMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const requireGdprConsentMock = vi.fn(async () => null)
const deriveTenantMock = vi.fn(async () => ({ tenantId: "default" }))
const runAndSignMock = vi.fn()
const runDigitalTwinMock = vi.fn()

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
vi.mock("@/lib/agents/digital-twin-vc", () => ({
  runAndSignDigitalTwinAgent: runAndSignMock,
}))
vi.mock("@/lib/agents/digital-twin-agent", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agents/digital-twin-agent")>(
    "@/lib/agents/digital-twin-agent",
  )
  return { ...actual, runDigitalTwinAgent: runDigitalTwinMock }
})

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/agents/digital-twin/simulate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const MOCK_FORECAST = {
  simulation_id: "sim_test",
  horizon_weeks: 52,
  backend_used: "fallback-exponential" as const,
  model_version: "fallback-exponential@0.1.0",
  trajectories: {
    hs_crp: {
      weekly_means: Array.from({ length: 52 }, (_, i) => 2.1 - i * 0.01),
      ci95_low: Array.from({ length: 52 }, (_, i) => 2.0 - i * 0.01),
      ci95_high: Array.from({ length: 52 }, (_, i) => 2.2 - i * 0.01),
    },
  },
  warnings: ["fallback"],
  fallbackUsed: true,
}

const VALID_BODY = {
  baseline: { hs_crp: 2.1 },
  interventions: [
    { intervention_id: "rapamycin_6mg", dose: 6, schedule: "weekly", start_week: 0 },
  ],
  outcomes: ["hs_crp"],
  horizonWeeks: 52,
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
  runAndSignMock.mockReset()
  runDigitalTwinMock.mockReset()
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/agents/digital-twin/simulate", () => {
  it("rejects unauthenticated requests", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/digital-twin/simulate/route")
    const res = await POST(buildRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it("rejects missing baseline / outcomes", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@x" } })
    const { POST } = await import("@/app/api/agents/digital-twin/simulate/route")

    const r1 = await POST(buildRequest({ ...VALID_BODY, baseline: undefined }))
    expect(r1.status).toBe(400)

    const r2 = await POST(buildRequest({ ...VALID_BODY, outcomes: [] }))
    expect(r2.status).toBe(400)
  })

  it("runs the signed agent and returns forecast, vc, and display policy", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@x" } })
    const vc = { proof: { proofValue: "z-test" } }
    runAndSignMock.mockResolvedValue({ forecast: MOCK_FORECAST, vc })

    const { POST } = await import("@/app/api/agents/digital-twin/simulate/route")
    const res = await POST(buildRequest(VALID_BODY))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.forecast.simulation_id).toBe("sim_test")
    expect(body.vc).toEqual(vc)
    expect(body.policy.tier).toBe("illustrative")
    expect(body.policy.isIllustrative).toBe(true)

    expect(runAndSignMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", baseline: VALID_BODY.baseline }),
    )
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "agent.digital_twin_simulated" }),
    )
  })

  it("supports skipSigning by running the unsigned agent only", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@x" } })
    runDigitalTwinMock.mockResolvedValue(MOCK_FORECAST)

    const { POST } = await import("@/app/api/agents/digital-twin/simulate/route")
    const res = await POST(buildRequest({ ...VALID_BODY, skipSigning: true }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.vc).toBeNull()
    expect(runDigitalTwinMock).toHaveBeenCalled()
    expect(runAndSignMock).not.toHaveBeenCalled()
  })

  it("maps DigitalTwinValidationError to 422", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@x" } })
    const { DigitalTwinValidationError } = await import("@/lib/agents/digital-twin-agent")
    runAndSignMock.mockRejectedValue(
      new DigitalTwinValidationError("bad horizon", "horizon_out_of_range"),
    )

    const { POST } = await import("@/app/api/agents/digital-twin/simulate/route")
    const res = await POST(buildRequest(VALID_BODY))

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe("horizon_out_of_range")
  })
})
