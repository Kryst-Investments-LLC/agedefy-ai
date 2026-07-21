import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const userFindUniqueMock = vi.fn()
const aeonForgeCandidateCreateMock = vi.fn()
const simulationResultCreateManyMock = vi.fn()
const virtualTwinRunCreateMock = vi.fn()
const discoverCandidatesMock = vi.fn()
const logAuditMock = vi.fn()
const applyRateLimitMock = vi.fn()
const executeWithCircuitBreakerMock = vi.fn(async ({ execute }: { execute: () => Promise<unknown> }) => execute())
const estimateAICreditCostMock = vi.fn()
const runWithReservedAICreditsMock = vi.fn()
const loggerInfoMock = vi.fn()
const loggerErrorMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: userFindUniqueMock,
    },
    aeonForgeCandidate: {
      create: aeonForgeCandidateCreateMock,
    },
    simulationResult: {
      createMany: simulationResultCreateManyMock,
    },
    virtualTwinRun: {
      create: virtualTwinRunCreateMock,
    },
  },
}))

vi.mock("@/lib/services/aeonforge", () => ({
  aeonforgeService: {
    discoverCandidates: discoverCandidatesMock,
  },
}))

vi.mock("@/lib/audit", () => ({
  logAudit: logAuditMock,
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: applyRateLimitMock,
}))

vi.mock("@/lib/circuit-breaker", () => ({
  CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {},
  executeWithCircuitBreaker: executeWithCircuitBreakerMock,
}))

vi.mock("@/lib/ai-credits", () => ({
  AICreditLimitError: class AICreditLimitError extends Error {
    status = 402
    requestedCredits = 25
    snapshot = {}
  },
  estimateAICreditCost: estimateAICreditCostMock,
  runWithReservedAICredits: runWithReservedAICreditsMock,
  serializeAICreditLimitError: vi.fn((error: { message: string }) => ({ error: error.message })),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: loggerInfoMock,
    error: loggerErrorMock,
  },
}))

vi.mock("@/lib/consent", () => ({
  requireGdprConsent: vi.fn().mockResolvedValue(null),
}))

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/aeonforge/prompt", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

describe("POST /api/aeonforge/prompt", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    userFindUniqueMock.mockReset()
    aeonForgeCandidateCreateMock.mockReset()
    simulationResultCreateManyMock.mockReset()
    virtualTwinRunCreateMock.mockReset()
    discoverCandidatesMock.mockReset()
    logAuditMock.mockReset()
    applyRateLimitMock.mockReset()
    executeWithCircuitBreakerMock.mockClear()
    estimateAICreditCostMock.mockReset()
    runWithReservedAICreditsMock.mockReset()
    loggerInfoMock.mockReset()
    loggerErrorMock.mockReset()
    applyRateLimitMock.mockReturnValue(undefined)
    estimateAICreditCostMock.mockReturnValue(35)
    runWithReservedAICreditsMock.mockImplementation(async ({ execute }: { execute: () => Promise<unknown> }) => execute())
  })

  it("returns 401 when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/aeonforge/prompt/route")

    const response = await POST(buildRequest({ prompt: "A valid discovery prompt that is long enough" }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("returns 400 for an invalid discovery payload", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1", role: "RESEARCHER" } })
    userFindUniqueMock.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      role: "MEMBER",
      discoveryTier: "explorer",
      biomarkers: [],
      profile: null,
    })

    const { POST } = await import("@/app/api/aeonforge/prompt/route")
    const response = await POST(buildRequest({ prompt: "too short" }))

    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error).toBe("Invalid discovery prompt payload")
  })

  it("returns 403 for a consumer member", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1", role: "MEMBER" } })
    const { POST } = await import("@/app/api/aeonforge/prompt/route")

    const response = await POST(buildRequest({
      prompt: "Discover candidate structures for a research-only assay",
    }))

    expect(response.status).toBe(403)
  })

  it("persists a discovered candidate and related simulations", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1", email: "user@example.com", role: "RESEARCHER" } })
    userFindUniqueMock.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      role: "RESEARCHER",
      discoveryTier: "enterprise",
      biomarkers: [{ name: "CRP", value: 1.4 }],
      profile: null,
    })
    discoverCandidatesMock.mockResolvedValue({
      status: "success",
      requestId: "af_req_1",
      candidates: [{
        id: "mol_1",
        iupacName: "Test Molecule",
        commonName: "TM-1",
        smiles: "CCO",
        mechanism: "Senolytic pathway modulation",
        targetPathways: ["mTOR"],
        estimatedHealthspanGain: 42,
        safetyProfile: {
          toxicity: 0.1,
          contraindications: ["Pregnancy"],
        },
      }],
      simulationResults: [{
        type: "virtual_cell",
        confidence: 0.91,
        result: {
          primaryOutcome: "Reduced inflammatory signaling",
        },
      }],
      virtualTwinProfile: {
        biologicalAge: 52,
        hallmarkResponsePredictions: {
          genomicInstability: 0.2,
          telomereDysfunction: 0.3,
          epigeneticAlteration: 0.4,
          lossOfProteostasis: 0.1,
          disabledMacroautophagy: 0.5,
          mitochondrialDysfunction: 0.4,
          cellularSenescence: 0.2,
          stemCellExhaustion: 0.3,
          alteredIntercelularCommunication: 0.4,
        },
      },
      confidence: 0.93,
      modelVersion: "test-model",
      warnings: [],
      disclaimers: ["All simulations are hypothetical."],
      executionTimeMs: 500,
    })
    aeonForgeCandidateCreateMock.mockResolvedValue({ id: "candidate_1" })
    simulationResultCreateManyMock.mockResolvedValue({ count: 1 })
    virtualTwinRunCreateMock.mockResolvedValue({ id: "twin_1" })

    const { POST } = await import("@/app/api/aeonforge/prompt/route")
    const response = await POST(buildRequest({
      prompt: "Discover novel senolytics targeting inflammatory aging signatures in cardiac tissue",
      includeSimulation: true,
      includeVirtualTwin: true,
    }))

    expect(response.status).toBe(201)
    expect(aeonForgeCandidateCreateMock).toHaveBeenCalled()
    expect(simulationResultCreateManyMock).toHaveBeenCalled()
    expect(virtualTwinRunCreateMock).toHaveBeenCalled()
    expect(logAuditMock).toHaveBeenCalled()

    const payload = await response.json()
    expect(payload.candidateId).toBe("candidate_1")
    expect(payload.candidates).toHaveLength(1)
    expect(payload.virtualTwinProfile).toBeDefined()
  })

  it("returns 503 when the AeonForge service is not configured", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1", email: "user@example.com", role: "RESEARCHER" } })
    userFindUniqueMock.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      role: "RESEARCHER",
      discoveryTier: "pro",
      biomarkers: [],
      profile: null,
    })
    discoverCandidatesMock.mockRejectedValue(new Error("AeonForge service not configured"))

    const { POST } = await import("@/app/api/aeonforge/prompt/route")
    const response = await POST(buildRequest({
      prompt: "Discover novel senolytic compounds for fibroblast aging",
    }))

    expect(response.status).toBe(503)
    const payload = await response.json()
    expect(payload.error).toBe("ÆonForge service not available")
  })
})
