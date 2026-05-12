import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const logAuditMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const requireGdprConsentMock = vi.fn(async () => null)
const deriveTenantMock = vi.fn(async () => ({ tenantId: "default" }))
const runDigitalTwinMock = vi.fn()
const mechanisticConfiguredMock = vi.fn(() => false)
const mechanisticCompareMock = vi.fn()

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
vi.mock("@/lib/agents/digital-twin-agent", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agents/digital-twin-agent")>(
    "@/lib/agents/digital-twin-agent",
  )
  return { ...actual, runDigitalTwinAgent: runDigitalTwinMock }
})
vi.mock("@/lib/sidecars", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sidecars")>("@/lib/sidecars")
  return {
    ...actual,
    mechanisticSidecar: {
      ...actual.mechanisticSidecar,
      configured: mechanisticConfiguredMock,
      compareStacks: mechanisticCompareMock,
    },
  }
})

function buildForecast(simId: string, finalCrp: number) {
  return {
    simulation_id: simId,
    horizon_weeks: 52,
    backend_used: "fallback-exponential" as const,
    model_version: "fallback-exponential@0.1.0",
    fallbackUsed: true,
    trajectories: {
      hs_crp: {
        weekly_means: Array.from({ length: 52 }, (_, i) =>
          2.1 - ((2.1 - finalCrp) * (i + 1)) / 52,
        ),
        ci95_low: Array.from({ length: 52 }, () => finalCrp - 0.2),
        ci95_high: Array.from({ length: 52 }, () => finalCrp + 0.2),
      },
    },
    warnings: [],
  }
}

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/agents/digital-twin/compare-stacks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = {
  baseline: { hs_crp: 2.1 },
  stack_a: [
    { intervention_id: "rapamycin_6mg", dose: 6, schedule: "weekly", start_week: 0 },
  ],
  stack_b: [
    { intervention_id: "metformin_500", dose: 500, schedule: "daily", start_week: 0 },
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
  runDigitalTwinMock.mockReset()
  mechanisticConfiguredMock.mockReset()
  mechanisticConfiguredMock.mockReturnValue(false)
  mechanisticCompareMock.mockReset()
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/agents/digital-twin/compare-stacks", () => {
  it("rejects unauthenticated requests", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/digital-twin/compare-stacks/route")
    const res = await POST(buildRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it("validates stack_a / stack_b / outcomes", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@x" } })
    const { POST } = await import("@/app/api/agents/digital-twin/compare-stacks/route")

    const r1 = await POST(buildRequest({ ...VALID_BODY, stack_a: undefined }))
    expect(r1.status).toBe(400)
    const r2 = await POST(buildRequest({ ...VALID_BODY, outcomes: [] }))
    expect(r2.status).toBe(400)
  })

  it("uses the sidecar when configured", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@x" } })
    mechanisticConfiguredMock.mockReturnValue(true)
    mechanisticCompareMock.mockResolvedValue({
      simulation_id_a: "sid_a",
      simulation_id_b: "sid_b",
      delta_of_deltas: {
        hs_crp: { stack_a_final: 1.6, stack_b_final: 1.9, difference: 0.3, ci95: [0.1, 0.5] },
      },
    })

    const { POST } = await import("@/app/api/agents/digital-twin/compare-stacks/route")
    const res = await POST(buildRequest(VALID_BODY))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.simulation_id_a).toBe("sid_a")
    expect(body.policy.tier).toBe("calibrated")
    expect(mechanisticCompareMock).toHaveBeenCalledTimes(1)
    expect(runDigitalTwinMock).not.toHaveBeenCalled()
  })

  it("falls back to local twin and computes delta-of-deltas when sidecar is not configured", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@x" } })
    runDigitalTwinMock
      .mockResolvedValueOnce(buildForecast("sim_a", 1.6))
      .mockResolvedValueOnce(buildForecast("sim_b", 1.9))

    const { POST } = await import("@/app/api/agents/digital-twin/compare-stacks/route")
    const res = await POST(buildRequest(VALID_BODY))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.simulation_id_a).toBe("sim_a")
    expect(body.simulation_id_b).toBe("sim_b")
    expect(body.delta_of_deltas.hs_crp.stack_a_final).toBeCloseTo(1.6, 5)
    expect(body.delta_of_deltas.hs_crp.stack_b_final).toBeCloseTo(1.9, 5)
    // stack_b is worse → difference (b - a) is positive
    expect(body.delta_of_deltas.hs_crp.difference).toBeGreaterThan(0)
    expect(body.policy.tier).toBe("illustrative")
    expect(body.policy.isIllustrative).toBe(true)
    expect(runDigitalTwinMock).toHaveBeenCalledTimes(2)
  })

  it("falls back to local twin on sidecar 5xx", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@x" } })
    mechanisticConfiguredMock.mockReturnValue(true)
    const { SidecarError } = await import("@/lib/sidecars")
    mechanisticCompareMock.mockRejectedValue(
      new SidecarError("solver down", 503, { code: "solver_unavailable" }),
    )
    runDigitalTwinMock
      .mockResolvedValueOnce(buildForecast("sim_a", 1.6))
      .mockResolvedValueOnce(buildForecast("sim_b", 1.9))

    const { POST } = await import("@/app/api/agents/digital-twin/compare-stacks/route")
    const res = await POST(buildRequest(VALID_BODY))

    expect(res.status).toBe(200)
    expect(runDigitalTwinMock).toHaveBeenCalledTimes(2)
  })

  it("propagates sidecar 4xx", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@x" } })
    mechanisticConfiguredMock.mockReturnValue(true)
    const { SidecarError } = await import("@/lib/sidecars")
    mechanisticCompareMock.mockRejectedValue(
      new SidecarError("bad input", 422, { code: "unknown_intervention" }),
    )

    const { POST } = await import("@/app/api/agents/digital-twin/compare-stacks/route")
    const res = await POST(buildRequest(VALID_BODY))

    expect(res.status).toBe(422)
    expect(runDigitalTwinMock).not.toHaveBeenCalled()
  })
})
