import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const requireGdprConsentMock = vi.fn(async () => null)
const deriveTenantMock = vi.fn(async () => ({ tenantId: "default" }))
const screenMock = vi.fn()
const logAuditMock = vi.fn(async () => undefined)
const signResultSafeMock = vi.fn(async () => null)

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
vi.mock("@/lib/provenance/sign-result", () => ({ signResultSafe: signResultSafeMock }))
vi.mock("@/lib/sidecars", () => ({
  screeningSidecar: { screen: screenMock },
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

const ASPIRIN_RESULT = {
  smiles: "CC(=O)Oc1ccccc1C(=O)O",
  canonical_smiles: "CC(=O)Oc1ccccc1C(=O)O",
  inchi: "InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)",
  inchi_key: "BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
  valid: true,
  sanitization_error: null,
  descriptors: {
    molecular_weight: 180.16,
    exact_molecular_weight: 180.0423,
    mol_log_p: 1.19,
    hbd: 1,
    hba: 3,
    tpsa: 63.6,
    rotatable_bonds: 3,
    aromatic_rings: 1,
    rings: 1,
    heavy_atom_count: 13,
    stereocenters: 0,
    frac_csp3: 0.11,
    qed: 0.55,
    sa_score: 1.9,
  },
  filters: {
    lipinski: { pass: true, violations: 0, details: { mw_ok: true, logp_ok: true, hbd_ok: true, hba_ok: true } },
    veber: { pass: true, details: { rotatable_bonds_ok: true, tpsa_ok: true } },
    ghose: { pass: true, details: { mw_ok: true, logp_ok: true, molar_refractivity_ok: true, atom_count_ok: true } },
    lead_like: { pass: true, details: { mw_ok: true, logp_ok: true, hbd_ok: true, hba_ok: true } },
    pains: { pass: true, alerts: [], checked: false },
  },
  admet_flags: {
    bbb_penetrant: { likely: true, basis: "TPSA≤90 Å² and MW≤400" },
    oral_absorption_risk: { flag: false, basis: "Lipinski rules met" },
    pgp_substrate_risk: { flag: false, basis: "MW≤400 and TPSA≤100" },
    herg_liability_risk: { flag: false, basis: "No basic-N+LogP>3.5 pattern" },
  },
  model_version: "screening-sidecar@1.0.0",
}

function buildRequest(body: unknown, extraHeaders: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/agents/chemistry/screen", {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  process.env.ENABLE_SCREENING_SIDECAR = "true"
  getServerSessionMock.mockReset()
  applyRateLimitMock.mockReset()
  applyRateLimitMock.mockReturnValue(null)
  requireGdprConsentMock.mockReset()
  requireGdprConsentMock.mockResolvedValue(null)
  deriveTenantMock.mockReset()
  deriveTenantMock.mockResolvedValue({ tenantId: "default" })
  screenMock.mockReset()
  logAuditMock.mockReset()
  logAuditMock.mockResolvedValue(undefined)
  signResultSafeMock.mockReset()
  signResultSafeMock.mockResolvedValue({ id: "urn:vc:screen-1", issuer: "did:web:biozephyra.ai", proof: { proofValue: "z", verificationMethod: "k" } })
})

afterEach(() => {
  delete process.env.ENABLE_SCREENING_SIDECAR
  vi.resetModules()
})

describe("POST /api/agents/chemistry/screen", () => {
  it("returns 404 when ENABLE_SCREENING_SIDECAR is not set", async () => {
    delete process.env.ENABLE_SCREENING_SIDECAR
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")
    const res = await POST(buildRequest({ smiles: "CC(=O)O" }))
    expect(res.status).toBe(404)
  })

  it("returns 401 for unauthenticated callers", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")
    const res = await POST(buildRequest({ smiles: "CC(=O)O" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when smiles field is missing", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")
    const res = await POST(buildRequest({}))
    expect(res.status).toBe(400)
  })

  it("returns 400 when smiles is an empty string", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")
    const res = await POST(buildRequest({ smiles: "" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when smiles exceeds 4000 characters", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")
    const res = await POST(buildRequest({ smiles: "C".repeat(4001) }))
    expect(res.status).toBe(400)
  })

  it("returns 400 for malformed JSON body", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")
    const req = new NextRequest("http://localhost:3000/api/agents/chemistry/screen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-valid-json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 403 when tenant context is invalid", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    deriveTenantMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")
    const res = await POST(buildRequest({ smiles: "CC(=O)O" }))
    expect(res.status).toBe(403)
  })

  it("returns the rate-limit response when rate-limited", async () => {
    const rl = new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429 })
    applyRateLimitMock.mockReturnValue(rl)
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")
    const res = await POST(buildRequest({ smiles: "CC(=O)O" }))
    expect(res.status).toBe(429)
  })

  it("attaches a provenance receipt (computational_estimate) to the screen result", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    screenMock.mockResolvedValue(ASPIRIN_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")
    const res = await POST(buildRequest({ smiles: "CC(=O)Oc1ccccc1C(=O)O" }))
    const json = (await res.json()) as Record<string, unknown>
    expect(json.valid).toBe(true)
    expect(json.provenance).toMatchObject({ id: "urn:vc:screen-1" })
    expect(signResultSafeMock).toHaveBeenCalledWith(
      expect.objectContaining({ resultType: "ScreeningResult", validationStatus: "computational_estimate" }),
    )
  })

  it("returns 200 with ScreenResult and writes audit log on success", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    screenMock.mockResolvedValue(ASPIRIN_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")

    const res = await POST(buildRequest({ smiles: "CC(=O)Oc1ccccc1C(=O)O" }))
    expect(res.status).toBe(200)

    const json = (await res.json()) as typeof ASPIRIN_RESULT
    expect(json.valid).toBe(true)
    expect(json.descriptors?.molecular_weight).toBeCloseTo(180.16, 1)
    expect(json.filters?.lipinski?.pass).toBe(true)
    expect(json.model_version).toBe("screening-sidecar@1.0.0")

    expect(screenMock).toHaveBeenCalledWith(
      { smiles: "CC(=O)Oc1ccccc1C(=O)O", include_pains: undefined },
      undefined,
    )
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "chemistry.smiles_screened",
        details: expect.objectContaining({
          valid: true,
          lipinski_pass: true,
          qed: 0.55,
          model_version: "screening-sidecar@1.0.0",
        }),
      }),
    )
  })

  it("threads traceparent header to screeningSidecar.screen", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    screenMock.mockResolvedValue(ASPIRIN_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")

    await POST(buildRequest({ smiles: "c1ccccc1" }, { traceparent: "00-abc-def-01" }))

    expect(screenMock).toHaveBeenCalledWith(
      expect.objectContaining({ smiles: "c1ccccc1" }),
      "00-abc-def-01",
    )
  })

  it("passes include_pains=true to screeningSidecar.screen", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    screenMock.mockResolvedValue({
      ...ASPIRIN_RESULT,
      filters: { ...ASPIRIN_RESULT.filters, pains: { pass: true, alerts: [], checked: true } },
    })
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")

    await POST(buildRequest({ smiles: "c1ccccc1", include_pains: true }))

    expect(screenMock).toHaveBeenCalledWith(
      expect.objectContaining({ include_pains: true }),
      undefined,
    )
  })

  it("forwards SidecarError status to the caller", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { SidecarError } = await import("@/lib/sidecars")
    screenMock.mockRejectedValue(new SidecarError("sidecar down", 503, { detail: "unavailable" }))
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")

    const res = await POST(buildRequest({ smiles: "CC(=O)O" }))
    expect(res.status).toBe(503)
    const json = (await res.json()) as { error: string; body: { detail: string } }
    expect(json.body.detail).toBe("unavailable")
  })

  it("maps SidecarError with out-of-range status to 502", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { SidecarError } = await import("@/lib/sidecars")
    screenMock.mockRejectedValue(new SidecarError("bad status", 0, null))
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")

    const res = await POST(buildRequest({ smiles: "CC(=O)O" }))
    expect(res.status).toBe(502)
  })

  it("returns 500 on unexpected non-sidecar errors", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    screenMock.mockRejectedValue(new Error("unexpected crash"))
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")

    const res = await POST(buildRequest({ smiles: "CC(=O)O" }))
    expect(res.status).toBe(500)
  })

  it("does not call screeningSidecar.screen if session is missing", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")
    await POST(buildRequest({ smiles: "CC(=O)O" }))
    expect(screenMock).not.toHaveBeenCalled()
  })

  it("sets audit tenantId from tenant context", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    deriveTenantMock.mockResolvedValue({ tenantId: "tenant-xyz" })
    screenMock.mockResolvedValue(ASPIRIN_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/screen/route")

    await POST(buildRequest({ smiles: "CC(=O)O" }))

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-xyz" }),
    )
  })
})
