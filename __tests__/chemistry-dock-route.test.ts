import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const requireGdprConsentMock = vi.fn(async () => null)
const deriveTenantMock = vi.fn(async () => ({ tenantId: "default" }))
const dockMock = vi.fn()
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
  screeningSidecar: { dock: dockMock },
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

const VALID_BOX = {
  center: { x: 15.19, y: 53.90, z: 16.92 },
  size: { x: 20.0, y: 20.0, z: 20.0 },
}

const FAKE_RECEPTOR_B64 = Buffer.from("ATOM      1  CA  ALA A   1       1.000   1.000   1.000  1.00  0.00    +0.000 C\nTER\n").toString("base64")

const DOCK_RESULT = {
  ligand_smiles: "CC(=O)Oc1ccccc1C(=O)O",
  binding_affinity_kcal_mol: -7.2,
  pose_scores_kcal_mol: [-7.2, -6.8, -6.5, -6.1, -5.9],
  best_pose_pdbqt: "REMARK VINA RESULT:     -7.200\nATOM      1  C   LIG A   1       0.000   0.000   0.000\nENDMDL\n",
  n_poses_returned: 5,
  exhaustiveness: 8,
  model_version: "screening-sidecar@1.0.0",
}

function buildRequest(body: unknown, extraHeaders: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/agents/chemistry/dock", {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  })
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    smiles: "CC(=O)Oc1ccccc1C(=O)O",
    receptor_pdbqt: FAKE_RECEPTOR_B64,
    box: VALID_BOX,
    ...overrides,
  }
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
  dockMock.mockReset()
  logAuditMock.mockReset()
  logAuditMock.mockResolvedValue(undefined)
})

afterEach(() => {
  delete process.env.ENABLE_SCREENING_SIDECAR
  vi.resetModules()
})

describe("POST /api/agents/chemistry/dock", () => {
  it("returns 404 when ENABLE_SCREENING_SIDECAR is not set", async () => {
    delete process.env.ENABLE_SCREENING_SIDECAR
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(404)
  })

  it("returns 401 for unauthenticated callers", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(401)
  })

  it("returns 400 when smiles is missing", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")
    const res = await POST(buildRequest({ receptor_pdbqt: FAKE_RECEPTOR_B64, box: VALID_BOX }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when receptor_pdbqt is missing", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")
    const res = await POST(buildRequest({ smiles: "CC(=O)O", box: VALID_BOX }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when box is missing", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")
    const res = await POST(buildRequest({ smiles: "CC(=O)O", receptor_pdbqt: FAKE_RECEPTOR_B64 }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when box.size.x is zero (non-positive)", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")
    const res = await POST(buildRequest(validPayload({
      box: { center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 20, z: 20 } },
    })))
    expect(res.status).toBe(400)
  })

  it("returns 400 when box.size.y is negative", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")
    const res = await POST(buildRequest(validPayload({
      box: { center: { x: 0, y: 0, z: 0 }, size: { x: 20, y: -5, z: 20 } },
    })))
    expect(res.status).toBe(400)
  })

  it("returns 400 when exhaustiveness exceeds 32", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")
    const res = await POST(buildRequest(validPayload({ exhaustiveness: 33 })))
    expect(res.status).toBe(400)
  })

  it("returns 400 when n_poses exceeds 20", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")
    const res = await POST(buildRequest(validPayload({ n_poses: 21 })))
    expect(res.status).toBe(400)
  })

  it("returns 400 for malformed JSON body", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")
    const req = new NextRequest("http://localhost:3000/api/agents/chemistry/dock", {
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
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(403)
  })

  it("returns the rate-limit response when rate-limited", async () => {
    const rl = new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429 })
    applyRateLimitMock.mockReturnValue(rl)
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")
    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(429)
  })

  it("returns 200 with DockResult and writes audit log on success", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    dockMock.mockResolvedValue(DOCK_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(200)

    const json = (await res.json()) as typeof DOCK_RESULT
    expect(json.binding_affinity_kcal_mol).toBe(-7.2)
    expect(json.pose_scores_kcal_mol).toHaveLength(5)
    expect(json.n_poses_returned).toBe(5)
    expect(json.exhaustiveness).toBe(8)
    expect(json.model_version).toBe("screening-sidecar@1.0.0")
    expect(json.best_pose_pdbqt).toContain("REMARK VINA RESULT")

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "chemistry.smiles_docked",
        details: expect.objectContaining({
          binding_affinity_kcal_mol: -7.2,
          exhaustiveness: 8,
          model_version: "screening-sidecar@1.0.0",
        }),
      }),
    )
  })

  it("threads traceparent to screeningSidecar.dock", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    dockMock.mockResolvedValue(DOCK_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")

    await POST(buildRequest(validPayload(), { traceparent: "00-trace-span-01" }))

    expect(dockMock).toHaveBeenCalledWith(
      expect.objectContaining({ smiles: "CC(=O)Oc1ccccc1C(=O)O" }),
      "00-trace-span-01",
    )
  })

  it("passes exhaustiveness and n_poses to screeningSidecar.dock", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    dockMock.mockResolvedValue({ ...DOCK_RESULT, exhaustiveness: 16, n_poses_returned: 3 })
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")

    await POST(buildRequest(validPayload({ exhaustiveness: 16, n_poses: 3 })))

    expect(dockMock).toHaveBeenCalledWith(
      expect.objectContaining({ exhaustiveness: 16, n_poses: 3 }),
      undefined,
    )
  })

  it("forwards SidecarError 422 (invalid SMILES from sidecar) to caller", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { SidecarError } = await import("@/lib/sidecars")
    dockMock.mockRejectedValue(new SidecarError("could not parse SMILES", 422, { detail: "RDKit could not parse SMILES" }))
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(422)
    const json = (await res.json()) as { body: { detail: string } }
    expect(json.body.detail).toContain("RDKit")
  })

  it("forwards SidecarError 503 (sidecar down) to caller", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { SidecarError } = await import("@/lib/sidecars")
    dockMock.mockRejectedValue(new SidecarError("sidecar unavailable", 503, null))
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(503)
  })

  it("maps SidecarError with out-of-range status to 502", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    const { SidecarError } = await import("@/lib/sidecars")
    dockMock.mockRejectedValue(new SidecarError("bad status", 0, null))
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(502)
  })

  it("returns 500 on unexpected non-sidecar errors", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    dockMock.mockRejectedValue(new Error("unexpected crash"))
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")

    const res = await POST(buildRequest(validPayload()))
    expect(res.status).toBe(500)
  })

  it("sets audit tenantId from tenant context", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@example.com" } })
    deriveTenantMock.mockResolvedValue({ tenantId: "tenant-abc" })
    dockMock.mockResolvedValue(DOCK_RESULT)
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")

    await POST(buildRequest(validPayload()))

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-abc" }),
    )
  })

  it("does not call screeningSidecar.dock when session is missing", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/agents/chemistry/dock/route")
    await POST(buildRequest(validPayload()))
    expect(dockMock).not.toHaveBeenCalled()
  })
})
