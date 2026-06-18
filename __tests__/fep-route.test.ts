import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const requireGdprConsentMock = vi.fn(async () => null)
const deriveTenantMock = vi.fn(async () => ({ tenantId: "default" }))
const perturbMock = vi.fn()
const logAuditMock = vi.fn(async () => undefined)
const signResultMock = vi.fn()

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
vi.mock("@/lib/provenance/sign-result", () => ({ signResult: signResultMock }))
vi.mock("@/lib/sidecars", () => ({
  fepSidecar: { perturb: perturbMock },
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

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FAKE_PDB = "ATOM      1  CA  ALA A   1       1.000   1.000   1.000  1.00  0.00\nTER\nEND\n"
const FAKE_PDBQT = "REMARK VINA RESULT:     -7.200\nATOM      1  C   LIG A   1       0.000\nENDMDL\n"

const FEP_RESULT = {
  ddg_kcal_mol: -1.42,
  ddg_sem_kcal_mol: 0.18,
  dg_candidate_kcal_mol: -9.61,
  dg_reference_kcal_mol: -8.19,
  convergence_flag: true,
  hysteresis_kcal_mol: 0.05,
  lambda_windows_used: 12,
  sampling_ns_per_window: 5,
  backend_used: "schrodinger-fep+" as const,
  schrodinger_job_id: "fep-job-001",
  model_version: "fep-sidecar@1.0.0",
}

const RESEARCHER_SESSION = {
  user: { id: "res-1", email: "researcher@example.com", role: "RESEARCHER" },
}

const ADMIN_SESSION = {
  user: { id: "adm-1", email: "admin@example.com", role: "ADMIN" },
}

const USER_SESSION = {
  user: { id: "usr-1", email: "user@example.com", role: "USER" },
}

function buildRequest(body: unknown, extraHeaders: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/agents/chemistry/fep", {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  })
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    smiles_reference: "CC(=O)Oc1ccccc1C(=O)O",
    smiles_candidate: "CC(=O)Oc1ccc(F)cc1C(=O)O",
    receptor_pdb: FAKE_PDB,
    docked_pose_pdbqt: FAKE_PDBQT,
    ...overrides,
  }
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.ENABLE_FEP_SIDECAR = "true"
  getServerSessionMock.mockReset()
  getServerSessionMock.mockResolvedValue(RESEARCHER_SESSION)
  applyRateLimitMock.mockReset()
  applyRateLimitMock.mockReturnValue(null)
  requireGdprConsentMock.mockReset()
  requireGdprConsentMock.mockResolvedValue(null)
  deriveTenantMock.mockReset()
  deriveTenantMock.mockResolvedValue({ tenantId: "default" })
  perturbMock.mockReset()
  logAuditMock.mockReset()
  logAuditMock.mockResolvedValue(undefined)
  signResultMock.mockReset()
  signResultMock.mockResolvedValue({
    id: "urn:vc:fep-1",
    issuer: "did:web:agedefy.ai",
    proof: { proofValue: "z", verificationMethod: "k" },
  })
})

afterEach(() => {
  delete process.env.ENABLE_FEP_SIDECAR
  vi.resetModules()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/agents/chemistry/fep", () => {
  // ── Feature gate ────────────────────────────────────────────────────────────

  it("returns 404 when ENABLE_FEP_SIDECAR is not set", async () => {
    delete process.env.ENABLE_FEP_SIDECAR
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(404)
  })

  it("returns 404 when ENABLE_FEP_SIDECAR is 'false'", async () => {
    process.env.ENABLE_FEP_SIDECAR = "false"
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(404)
  })

  // ── Rate limit ───────────────────────────────────────────────────────────────

  it("returns the rate-limit response when rate-limited", async () => {
    const rl = new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429 })
    applyRateLimitMock.mockReturnValue(rl)
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(429)
  })

  // ── Authentication ───────────────────────────────────────────────────────────

  it("returns 401 for unauthenticated callers", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(401)
  })

  it("does not call fepSidecar.perturb when session is missing", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    await POST(buildRequest(validPayload()))
    expect(perturbMock).not.toHaveBeenCalled()
  })

  // ── Role gate ────────────────────────────────────────────────────────────────

  it("returns 403 when user role is USER (not RESEARCHER or ADMIN)", async () => {
    getServerSessionMock.mockResolvedValue(USER_SESSION)
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(403)
  })

  it("returns 403 when user has no role set", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(403)
  })

  // ── GDPR consent ─────────────────────────────────────────────────────────────

  it("returns the consent response when consent is missing", async () => {
    const consentResponse = new Response(JSON.stringify({ error: "Consent required" }), { status: 451 })
    requireGdprConsentMock.mockResolvedValue(consentResponse)
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(451)
  })

  // ── Tenant context ───────────────────────────────────────────────────────────

  it("returns 403 when tenant context is invalid", async () => {
    deriveTenantMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(403)
  })

  // ── Body validation ──────────────────────────────────────────────────────────

  it("returns 400 for malformed JSON body", async () => {
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const req = new NextRequest("http://localhost:3000/api/agents/chemistry/fep", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 when smiles_reference is missing", async () => {
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest({
      smiles_candidate: "CC(=O)O",
      receptor_pdb: FAKE_PDB,
      docked_pose_pdbqt: FAKE_PDBQT,
    }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when smiles_candidate is missing", async () => {
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest({
      smiles_reference: "CC(=O)O",
      receptor_pdb: FAKE_PDB,
      docked_pose_pdbqt: FAKE_PDBQT,
    }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when receptor_pdb is missing", async () => {
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest({
      smiles_reference: "CC(=O)O",
      smiles_candidate: "CC(=O)F",
      docked_pose_pdbqt: FAKE_PDBQT,
    }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when docked_pose_pdbqt is too short (< 10 chars)", async () => {
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload({ docked_pose_pdbqt: "short" })))
    expect(res.status).toBe(400)
  })

  it("returns 400 when lambda_windows is below minimum (< 8)", async () => {
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload({ lambda_windows: 4 })))
    expect(res.status).toBe(400)
  })

  it("returns 400 when lambda_windows exceeds maximum (> 24)", async () => {
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload({ lambda_windows: 25 })))
    expect(res.status).toBe(400)
  })

  it("returns 400 when temperature_K is below minimum (< 270)", async () => {
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload({ temperature_K: 200 })))
    expect(res.status).toBe(400)
  })

  it("returns 400 when temperature_K exceeds maximum (> 320)", async () => {
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload({ temperature_K: 400 })))
    expect(res.status).toBe(400)
  })

  it("returns 400 when sampling_ns_per_window exceeds maximum (> 20)", async () => {
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload({ sampling_ns_per_window: 21 })))
    expect(res.status).toBe(400)
  })

  // ── Happy path ───────────────────────────────────────────────────────────────

  it("returns 200 with FepResult and writes audit log on success (RESEARCHER)", async () => {
    perturbMock.mockResolvedValue(FEP_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(200)

    const json = (await res.json()) as typeof FEP_RESULT
    expect(json.ddg_kcal_mol).toBe(-1.42)
    expect(json.convergence_flag).toBe(true)
    expect(json.backend_used).toBe("schrodinger-fep+")
    expect(json.schrodinger_job_id).toBe("fep-job-001")
    expect(json.model_version).toBe("fep-sidecar@1.0.0")

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "chemistry.fep_perturbation_run",
        actorUserId: "res-1",
        details: expect.objectContaining({
          ddg_kcal_mol: -1.42,
          convergence_flag: true,
          backend_used: "schrodinger-fep+",
          model_version: "fep-sidecar@1.0.0",
        }),
      }),
    )
  })

  it("attaches a provenance receipt to the FEP result", async () => {
    perturbMock.mockResolvedValue(FEP_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload()))
    const json = (await res.json()) as Record<string, any>
    expect(json.provenance).toEqual(
      expect.objectContaining({ id: "urn:vc:fep-1", issuer: "did:web:agedefy.ai" }),
    )
    expect(signResultMock).toHaveBeenCalledWith(
      expect.objectContaining({ resultType: "FepResult", validationStatus: "computational_estimate" }),
    )
  })

  it("still returns 200 with provenance:null when signing fails", async () => {
    perturbMock.mockResolvedValue(FEP_RESULT)
    signResultMock.mockRejectedValue(new Error("vc-signer down"))
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(200)
    const json = (await res.json()) as Record<string, any>
    expect(json.ddg_kcal_mol).toBe(-1.42)
    expect(json.provenance).toBeNull()
  })

  it("returns 200 with FepResult for ADMIN role", async () => {
    getServerSessionMock.mockResolvedValue(ADMIN_SESSION)
    perturbMock.mockResolvedValue(FEP_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(200)
  })

  it("threads traceparent header to fepSidecar.perturb", async () => {
    perturbMock.mockResolvedValue(FEP_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")

    await POST(buildRequest(validPayload(), { traceparent: "00-abc-def-01" }))

    expect(perturbMock).toHaveBeenCalledWith(
      expect.objectContaining({ smiles_reference: "CC(=O)Oc1ccccc1C(=O)O" }),
      "00-abc-def-01",
    )
  })

  it("passes optional FEP params to fepSidecar.perturb", async () => {
    perturbMock.mockResolvedValue({ ...FEP_RESULT, lambda_windows_used: 16, sampling_ns_per_window: 8 })
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")

    await POST(buildRequest(validPayload({ lambda_windows: 16, sampling_ns_per_window: 8, temperature_K: 300 })))

    expect(perturbMock).toHaveBeenCalledWith(
      expect.objectContaining({ lambda_windows: 16, sampling_ns_per_window: 8, temperature_K: 300 }),
      undefined,
    )
  })

  it("omits optional params from sidecar call when not provided", async () => {
    perturbMock.mockResolvedValue(FEP_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")

    await POST(buildRequest(validPayload()))

    const call = perturbMock.mock.calls[0][0] as Record<string, unknown>
    expect(call.lambda_windows).toBeUndefined()
    expect(call.sampling_ns_per_window).toBeUndefined()
    expect(call.temperature_K).toBeUndefined()
  })

  it("sets audit tenantId from tenant context", async () => {
    deriveTenantMock.mockResolvedValue({ tenantId: "tenant-xyz" })
    perturbMock.mockResolvedValue(FEP_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")

    await POST(buildRequest(validPayload()))

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-xyz" }),
    )
  })

  // ── SidecarError passthrough ──────────────────────────────────────────────────

  it("forwards SidecarError 422 (invalid SMILES from sidecar) to caller", async () => {
    const { SidecarError } = await import("@/lib/sidecars")
    perturbMock.mockRejectedValue(new SidecarError("invalid SMILES", 422, { detail: "RDKit could not parse" }))
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(422)
    const json = (await res.json()) as { body: { detail: string } }
    expect(json.body.detail).toContain("RDKit")
  })

  it("forwards SidecarError 503 (sidecar unavailable) to caller", async () => {
    const { SidecarError } = await import("@/lib/sidecars")
    perturbMock.mockRejectedValue(new SidecarError("sidecar unavailable", 503, null))
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(503)
  })

  it("maps SidecarError with out-of-range HTTP status to 502", async () => {
    const { SidecarError } = await import("@/lib/sidecars")
    perturbMock.mockRejectedValue(new SidecarError("bad status", 0, null))
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(502)
  })

  it("returns 500 on unexpected non-sidecar errors", async () => {
    perturbMock.mockRejectedValue(new Error("unexpected crash"))
    const { POST } = await import("@/app/api/agents/chemistry/fep/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(500)
  })
})
