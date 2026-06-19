import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const causalHealthMock = vi.fn()
const dpHealthMock = vi.fn()
const vcHealthMock = vi.fn()
const mechHealthMock = vi.fn()
const mechConfiguredMock = vi.fn(() => Boolean(process.env.MECHANISTIC_SIDECAR_URL))

vi.mock("@/lib/sidecars", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sidecars")>("@/lib/sidecars")
  return {
    ...actual,
    causalSidecar: { ...actual.causalSidecar, health: causalHealthMock },
    dpAccountant: { ...actual.dpAccountant, health: dpHealthMock },
    vcSigner: { ...actual.vcSigner, health: vcHealthMock },
    mechanisticSidecar: {
      ...actual.mechanisticSidecar,
      health: mechHealthMock,
      configured: mechConfiguredMock,
    },
  }
})

beforeEach(() => {
  causalHealthMock.mockReset()
  dpHealthMock.mockReset()
  vcHealthMock.mockReset()
  mechHealthMock.mockReset()
  mechConfiguredMock.mockReset()
  mechConfiguredMock.mockImplementation(() => Boolean(process.env.MECHANISTIC_SIDECAR_URL))
  delete process.env.CAUSAL_SIDECAR_URL
  delete process.env.DP_ACCOUNTANT_URL
  delete process.env.VC_SIGNER_URL
  delete process.env.MECHANISTIC_SIDECAR_URL
})

afterEach(() => {
  delete process.env.CAUSAL_SIDECAR_URL
  delete process.env.DP_ACCOUNTANT_URL
  delete process.env.VC_SIGNER_URL
  delete process.env.MECHANISTIC_SIDECAR_URL
  vi.resetModules()
})

describe("probeSidecars", () => {
  it("reports `not-configured` for every sidecar when no env vars are set", async () => {
    const { probeSidecars } = await import("@/lib/health/sidecar-health")
    const result = await probeSidecars()
    expect(result.map((r) => r.name).sort()).toEqual([
      "causal",
      "dp-accountant",
      "mechanistic",
      "openmm",
      "screening",
      "vc-signer",
    ])
    for (const entry of result) {
      expect(entry.status).toBe("not-configured")
      expect(entry.configured).toBe(false)
      expect(entry.url).toBeNull()
    }
    expect(causalHealthMock).not.toHaveBeenCalled()
  })

  it("reports `ok` with version when a sidecar is configured and healthy", async () => {
    process.env.CAUSAL_SIDECAR_URL = "http://causal.test"
    process.env.VC_SIGNER_URL = "http://vc.test"
    causalHealthMock.mockResolvedValue({ status: "ok", version: "0.2.0" })
    vcHealthMock.mockResolvedValue({ status: "ok", issuer: "did:web:vc.biozephyra.ai" })

    const { probeSidecars } = await import("@/lib/health/sidecar-health")
    const result = await probeSidecars()
    const causal = result.find((r) => r.name === "causal")!
    const vc = result.find((r) => r.name === "vc-signer")!
    expect(causal.status).toBe("ok")
    expect(causal.configured).toBe(true)
    expect(causal.url).toBe("http://causal.test")
    expect(causal.version).toBe("0.2.0")
    expect(vc.status).toBe("ok")
    expect(vc.version).toBe("did:web:vc.biozephyra.ai")
  })

  it("reports `degraded` with error message when a sidecar probe throws", async () => {
    process.env.DP_ACCOUNTANT_URL = "http://dp.test"
    dpHealthMock.mockRejectedValue(new Error("ECONNREFUSED"))

    const { probeSidecars } = await import("@/lib/health/sidecar-health")
    const result = await probeSidecars()
    const dp = result.find((r) => r.name === "dp-accountant")!
    expect(dp.status).toBe("degraded")
    expect(dp.configured).toBe(true)
    expect(dp.error).toContain("ECONNREFUSED")
  })

  it("reports `degraded` when sidecar /healthz returns non-ok status string", async () => {
    process.env.MECHANISTIC_SIDECAR_URL = "http://mech.test"
    mechHealthMock.mockResolvedValue({ status: "starting", version: "0.1.0" })

    const { probeSidecars } = await import("@/lib/health/sidecar-health")
    const result = await probeSidecars()
    const mech = result.find((r) => r.name === "mechanistic")!
    expect(mech.status).toBe("degraded")
    expect(mech.version).toBe("0.1.0")
  })
})
