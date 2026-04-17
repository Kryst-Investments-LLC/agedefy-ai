import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const userFindUniqueMock = vi.fn()
const discoverCandidatesMock = vi.fn()
const applyRateLimitMock = vi.fn()
const createIdempotencyFingerprintMock = vi.fn(() => "aeonforge-test-fingerprint")
const executeRouteIdempotentJsonMutationMock = vi.fn(
  async ({ request, execute }: { request: Request; execute: () => Promise<{ status: number; body: unknown }> }) => {
    if (!request.headers.get("idempotency-key")) {
      return Response.json(
        { error: "Idempotency-Key header is required for this mutation route." },
        { status: 400, headers: { "Idempotency-Key-Required": "true" } },
      )
    }

    const result = await execute()
    return Response.json(result.body, { status: result.status })
  },
)
const loggerInfoMock = vi.fn()
const loggerErrorMock = vi.fn()
let requestSequence = 0

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
  },
}))

vi.mock("@/lib/idempotency", () => ({
  createIdempotencyFingerprint: createIdempotencyFingerprintMock,
  executeRouteIdempotentJsonMutation: executeRouteIdempotentJsonMutationMock,
}))

vi.mock("@/lib/services/aeonforge", () => ({
  aeonforgeService: {
    discoverCandidates: discoverCandidatesMock,
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: applyRateLimitMock,
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: loggerInfoMock,
    error: loggerErrorMock,
  },
}))

function buildRequest(body: unknown) {
  requestSequence += 1

  return new NextRequest("http://localhost:3000/api/ai/aeonforge", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `aeonforge-smart-router-${requestSequence}`,
    },
    body: JSON.stringify(body),
  })
}

describe("POST /api/ai/aeonforge", () => {
  beforeEach(() => {
    requestSequence = 0
    getServerSessionMock.mockReset()
    userFindUniqueMock.mockReset()
    discoverCandidatesMock.mockReset()
    applyRateLimitMock.mockReset()
    createIdempotencyFingerprintMock.mockClear()
    executeRouteIdempotentJsonMutationMock.mockClear()
    loggerInfoMock.mockReset()
    loggerErrorMock.mockReset()
    applyRateLimitMock.mockReturnValue(undefined)
  })

  it("returns 401 when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/ai/aeonforge/route")

    const response = await POST(buildRequest({ query: "Valid escalation query for longevity discovery" }))

    expect(response.status).toBe(401)
  })

  it("does not escalate for explorer tier users", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1" } })
    userFindUniqueMock.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      role: "MEMBER",
      discoveryTier: "explorer",
      profile: null,
      biomarkers: [],
    })

    const { POST } = await import("@/app/api/ai/aeonforge/route")
    const response = await POST(buildRequest({
      query: "Identify candidate compounds for inflammatory biomarker reduction",
      autoEscalate: true,
    }))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.escalated).toBe(false)
    expect(payload.tier).toBe("explorer")
    expect(discoverCandidatesMock).not.toHaveBeenCalled()
  })

  it("escalates for pro and researcher users", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user_1" } })
    userFindUniqueMock.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      role: "RESEARCHER",
      discoveryTier: "pro",
      profile: null,
      biomarkers: [{ name: "CRP", value: 2.2 }],
    })
    discoverCandidatesMock.mockResolvedValue({
      requestId: "af_req_2",
      candidates: [{ id: "mol_1", iupacName: "Molecule 1" }],
      confidence: 0.88,
      disclaimers: ["Hypothetical only"],
    })

    const { POST } = await import("@/app/api/ai/aeonforge/route")
    const response = await POST(buildRequest({
      query: "Find senolytic candidates optimized for elevated CRP and mitochondrial dysfunction",
      autoEscalate: true,
      userBiomarkers: { CRP: 2.2 },
    }))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.escalated).toBe(true)
    expect(payload.requestId).toBe("af_req_2")
    expect(discoverCandidatesMock).toHaveBeenCalled()
  })
})