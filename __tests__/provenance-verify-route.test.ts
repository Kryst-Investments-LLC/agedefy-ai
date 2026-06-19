import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const applyRateLimitMock = vi.fn(() => null)
const verifyMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/rate-limit", () => ({ applyRateLimit: applyRateLimitMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/sidecars", () => ({
  vcSigner: { verify: verifyMock },
  SidecarError: class SidecarError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.status = status
      this.body = body
    }
  },
}))

const RECEIPT = {
  id: "urn:vc:fep-1",
  issuer: "did:web:biozephyra.ai",
  proof: { proofValue: "z", verificationMethod: "k" },
  credentialSubject: {
    id: "urn:biozephyra:result:FepResult",
    resultType: "FepResult",
    validation_status: "computational_estimate",
    disclaimer: "Computational estimate — requires experimental lab validation. Not validated. Not medical advice.",
    model_version: "fep-sidecar@1.0.0",
    backend_used: "schrodinger-fep+",
    inputs_hash: "sha256:abc",
  },
}

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/provenance/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  applyRateLimitMock.mockReset()
  applyRateLimitMock.mockReturnValue(null)
  verifyMock.mockReset()
  verifyMock.mockResolvedValue({ valid: true, errors: [] })
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/provenance/verify", () => {
  it("returns the rate-limit response when rate-limited", async () => {
    applyRateLimitMock.mockReturnValue(new Response(null, { status: 429 }))
    const { POST } = await import("@/app/api/provenance/verify/route")
    expect((await POST(buildRequest({ vc: RECEIPT }))).status).toBe(429)
  })

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("@/app/api/provenance/verify/route")
    expect((await POST(buildRequest("not-json"))).status).toBe(400)
  })

  it("returns 400 when no vc with a proof is provided", async () => {
    const { POST } = await import("@/app/api/provenance/verify/route")
    expect((await POST(buildRequest({ vc: { id: "x" } }))).status).toBe(400)
  })

  it("returns valid=true and re-surfaces the honesty status", async () => {
    const { POST } = await import("@/app/api/provenance/verify/route")
    const res = await POST(buildRequest({ vc: RECEIPT }))
    expect(res.status).toBe(200)
    const json = (await res.json()) as Record<string, any>
    expect(json.valid).toBe(true)
    expect(json.validationStatus).toBe("computational_estimate")
    expect(json.disclaimer).toMatch(/Not validated/i)
    expect(json.resultType).toBe("FepResult")
    expect(json.modelVersion).toBe("fep-sidecar@1.0.0")
  })

  it("surfaces the disclaimer even when the signature is INVALID (tamper)", async () => {
    verifyMock.mockResolvedValue({ valid: false, errors: ["signature mismatch"] })
    const { POST } = await import("@/app/api/provenance/verify/route")
    const res = await POST(buildRequest({ vc: RECEIPT }))
    const json = (await res.json()) as Record<string, any>
    expect(json.valid).toBe(false)
    expect(json.errors).toContain("signature mismatch")
    // The "not validated" framing must persist regardless of signature validity.
    expect(json.disclaimer).toMatch(/Not validated/i)
  })

  it("forwards a SidecarError status from the signer", async () => {
    const { SidecarError } = await import("@/lib/sidecars")
    verifyMock.mockRejectedValue(new SidecarError("signer down", 503, null))
    const { POST } = await import("@/app/api/provenance/verify/route")
    expect((await POST(buildRequest({ vc: RECEIPT }))).status).toBe(503)
  })

  it("returns 500 on unexpected errors", async () => {
    verifyMock.mockRejectedValue(new Error("boom"))
    const { POST } = await import("@/app/api/provenance/verify/route")
    expect((await POST(buildRequest({ vc: RECEIPT }))).status).toBe(500)
  })
})
