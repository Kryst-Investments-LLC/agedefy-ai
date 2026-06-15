import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const requireGdprConsentMock = vi.fn(async () => null)
const deriveTenantMock = vi.fn(async () => ({ tenantId: "default" }))
const refineMock = vi.fn()
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
vi.mock("@/lib/sidecars", () => ({
  openmmSidecar: { refine: refineMock },
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

const FAKE_RECEPTOR_B64 = Buffer.from(
  "ATOM      1  CA  ALA A   1       1.000   1.000   1.000  1.00  0.00           C\nTER\nEND\n",
).toString("base64")

const FAKE_POSE_B64 = Buffer.from(
  "REMARK VINA RESULT:     -7.200      0.000      0.000\n" +
    "ATOM      1  C   LIG A   1       0.000   0.000   0.000  0.00  0.00    +0.000 C\n" +
    "ENDMDL\n",
).toString("base64")

const REFINE_RESULT = {
  smiles: "CC(=O)Oc1ccccc1C(=O)O",
  refine_mode: "minimize",
  force_field_used: { protein: "amber14-all", small_molecule: "openff-2.0.0", water: "tip3p" },
  receptor_format_received: "pdb",
  receptor_conversion_warning: null,
  initial_potential_energy_kj_mol: -1234.5,
  minimized_potential_energy_kj_mol: -1345.6,
  pose_rmsd_angstrom: 0.42,
  mmgbsa_binding_energy_kcal_mol: -9.1,
  mmgbsa_std_kcal_mol: null,
  convergence_flag: true,
  n_trajectory_frames: 0,
  refined_complex_pdb: Buffer.from("ATOM...END\n").toString("base64"),
  md_ranking_score: 0.72,
  weights_used: { mmgbsa: 0.65, rmsd_penalty: 0.35 },
  mmgbsa_accuracy_note: "Single-point estimate.",
  model_version: "openmm-sidecar@1.0.0",
}

function buildRequest(body: unknown, extraHeaders: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/agents/chemistry/refine", {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  })
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    smiles: "CC(=O)Oc1ccccc1C(=O)O",
    receptor: FAKE_RECEPTOR_B64,
    docked_pose_pdbqt: FAKE_POSE_B64,
    ...overrides,
  }
}

beforeEach(() => {
  process.env.ENABLE_OPENMM_SIDECAR = "true"
  getServerSessionMock.mockReset()
  applyRateLimitMock.mockReset()
  applyRateLimitMock.mockReturnValue(null)
  requireGdprConsentMock.mockReset()
  requireGdprConsentMock.mockResolvedValue(null)
  deriveTenantMock.mockReset()
  deriveTenantMock.mockResolvedValue({ tenantId: "default" })
  refineMock.mockReset()
  logAuditMock.mockReset()
  logAuditMock.mockResolvedValue(undefined)
})

afterEach(() => {
  delete process.env.ENABLE_OPENMM_SIDECAR
  vi.resetModules()
})

describe("POST /api/agents/chemistry/refine", () => {
  it("returns 404 when ENABLE_OPENMM_SIDECAR is not set", async () => {
    delete process.env.ENABLE_OPENMM_SIDECAR
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(404)
  })

  it("returns 401 for unauthenticated callers", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(401)
  })

  it("returns 400 when smiles is missing", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    const res = await POST(buildRequest({ receptor: FAKE_RECEPTOR_B64, docked_pose_pdbqt: FAKE_POSE_B64 }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when receptor is missing", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    const res = await POST(buildRequest({ smiles: "CC(=O)O", docked_pose_pdbqt: FAKE_POSE_B64 }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when docked_pose_pdbqt is missing", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    const res = await POST(buildRequest({ smiles: "CC(=O)O", receptor: FAKE_RECEPTOR_B64 }))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid receptor_format", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    const res = await POST(buildRequest(validPayload({ receptor_format: "sdf" })))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid refine_mode", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    const res = await POST(buildRequest(validPayload({ refine_mode: "npt" })))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid force_field.small_molecule", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    const res = await POST(buildRequest(validPayload({ force_field: { small_molecule: "gaff2" } })))
    expect(res.status).toBe(400)
  })

  it("returns 400 when production_ps exceeds 2000", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    const res = await POST(buildRequest(validPayload({ simulation: { production_ps: 9999 } })))
    expect(res.status).toBe(400)
  })

  it("returns 400 when minimization_steps is below minimum", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    const res = await POST(buildRequest(validPayload({ simulation: { minimization_steps: 10 } })))
    expect(res.status).toBe(400)
  })

  it("returns 400 for malformed JSON body", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    const req = new NextRequest("http://localhost:3000/api/agents/chemistry/refine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 403 when tenant context is invalid", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    deriveTenantMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(403)
  })

  it("returns the rate-limit response when rate-limited", async () => {
    const rl = new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429 })
    applyRateLimitMock.mockReturnValue(rl)
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(429)
  })

  it("returns 200 with RefineResult and writes audit log on success", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    refineMock.mockResolvedValue(REFINE_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(200)

    const json = (await res.json()) as typeof REFINE_RESULT
    expect(json.smiles).toBe("CC(=O)Oc1ccccc1C(=O)O")
    expect(json.refine_mode).toBe("minimize")
    expect(json.mmgbsa_binding_energy_kcal_mol).toBe(-9.1)
    expect(json.pose_rmsd_angstrom).toBe(0.42)
    expect(json.md_ranking_score).toBe(0.72)
    expect(json.convergence_flag).toBe(true)
    expect(json.weights_used).toEqual({ mmgbsa: 0.65, rmsd_penalty: 0.35 })
    expect(json.model_version).toMatch(/^openmm-sidecar@/)

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "chemistry.md_refinement_run",
        details: expect.objectContaining({
          refine_mode: "minimize",
          mmgbsa_binding_energy_kcal_mol: -9.1,
          md_ranking_score: 0.72,
          convergence_flag: true,
        }),
      }),
    )
  })

  it("threads traceparent to openmmSidecar.refine", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    refineMock.mockResolvedValue(REFINE_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")

    await POST(buildRequest(validPayload(), { traceparent: "00-trace-span-01" }))

    expect(refineMock).toHaveBeenCalledWith(
      expect.objectContaining({ smiles: "CC(=O)Oc1ccccc1C(=O)O" }),
      "00-trace-span-01",
    )
  })

  it("passes ranking_weights to openmmSidecar.refine", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    refineMock.mockResolvedValue({
      ...REFINE_RESULT,
      weights_used: { mmgbsa: 0.8, rmsd_penalty: 0.2 },
    })
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")

    await POST(buildRequest(validPayload({ ranking_weights: { mmgbsa: 0.8, rmsd_penalty: 0.2 } })))

    expect(refineMock).toHaveBeenCalledWith(
      expect.objectContaining({ ranking_weights: { mmgbsa: 0.8, rmsd_penalty: 0.2 } }),
      undefined,
    )
  })

  it("includes receptor_conversion_warning in response for pdbqt receptor", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    refineMock.mockResolvedValue({
      ...REFINE_RESULT,
      receptor_format_received: "pdbqt",
      receptor_conversion_warning: "PDBQT receptor converted to PDB; verify protonation.",
    })
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")

    const res = await POST(buildRequest(validPayload({ receptor_format: "pdbqt" })))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { receptor_conversion_warning: string | null }
    expect(json.receptor_conversion_warning).not.toBeNull()
    expect(json.receptor_conversion_warning).toContain("PDBQT")
  })

  it("forwards SidecarError 422 (invalid SMILES) to caller", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { SidecarError } = await import("@/lib/sidecars")
    refineMock.mockRejectedValue(
      new SidecarError("could not parse SMILES", 422, { detail: "RDKit could not parse SMILES" }),
    )
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(422)
    const json = (await res.json()) as { body: { detail: string } }
    expect(json.body.detail).toContain("RDKit")
  })

  it("forwards SidecarError 503 (sidecar down) to caller", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { SidecarError } = await import("@/lib/sidecars")
    refineMock.mockRejectedValue(new SidecarError("sidecar unavailable", 503, null))
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(503)
  })

  it("maps SidecarError with out-of-range status to 502", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { SidecarError } = await import("@/lib/sidecars")
    refineMock.mockRejectedValue(new SidecarError("bad status", 0, null))
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(502)
  })

  it("returns 500 on unexpected non-sidecar errors", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    refineMock.mockRejectedValue(new Error("unexpected crash"))
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(500)
  })

  it("sets audit tenantId from tenant context", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    deriveTenantMock.mockResolvedValue({ tenantId: "tenant-xyz" })
    refineMock.mockResolvedValue(REFINE_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")

    await POST(buildRequest(validPayload()))

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-xyz" }),
    )
  })

  it("does not call openmmSidecar.refine when session is missing", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/chemistry/refine/route")
    await POST(buildRequest(validPayload()))
    expect(refineMock).not.toHaveBeenCalled()
  })
})
