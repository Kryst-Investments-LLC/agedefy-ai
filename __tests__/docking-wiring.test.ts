import { describe, expect, it, vi } from "vitest"

import {
  runDock,
  encodeReceptor,
  buildDockBody,
  decodePose,
  looksLikeRawPdbqt,
  DOCK_ENDPOINT,
  SIDECAR_DISABLED_MESSAGE,
  type DockParams,
} from "@/lib/discovery/docking-wiring"

const RAW_RECEPTOR = "REMARK prepared receptor\nATOM      1  N   ALA A   1      11.1  22.2  33.3\nHETATM   2  C   LIG A   2"
const BASE_PARAMS: DockParams = {
  receptor: RAW_RECEPTOR,
  smiles: "CC(=O)Oc1ccccc1C(=O)O",
  center: { x: 1, y: 2, z: 3 },
  size: { x: 20, y: 22, z: 24 },
  exhaustiveness: 8,
  nPoses: 5,
}

/** Build a minimal Response-like object. */
function mockRes(status: number, jsonBody: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => jsonBody,
  }
}

describe("docking-wiring", () => {
  describe("helpers", () => {
    it("detects raw PDBQT vs base64", () => {
      expect(looksLikeRawPdbqt(RAW_RECEPTOR)).toBe(true)
      expect(looksLikeRawPdbqt("Zm9vYmFy")).toBe(false)
    })

    it("base64-encodes raw receptor and preserves rawText", () => {
      const { base64, rawText } = encodeReceptor(RAW_RECEPTOR)
      expect(rawText).toBe(RAW_RECEPTOR)
      expect(atob(base64)).toBe(RAW_RECEPTOR)
    })

    it("passes through an already-base64 receptor and decodes rawText", () => {
      const b64 = btoa(RAW_RECEPTOR)
      const { base64, rawText } = encodeReceptor(b64)
      expect(base64).toBe(b64)
      expect(rawText).toBe(RAW_RECEPTOR)
    })

    it("buildDockBody shapes the API payload", () => {
      const body = buildDockBody(BASE_PARAMS, "B64REC")
      expect(body).toEqual({
        smiles: "CC(=O)Oc1ccccc1C(=O)O",
        receptor_pdbqt: "B64REC",
        box: { center: { x: 1, y: 2, z: 3 }, size: { x: 20, y: 22, z: 24 } },
        exhaustiveness: 8,
        n_poses: 5,
      })
    })

    it("decodePose base64-decodes, falling back to raw", () => {
      expect(decodePose(btoa("POSE"))).toBe("POSE")
    })
  })

  describe("runDock — request wiring", () => {
    it("POSTs the correct endpoint and body, returns decoded render state", async () => {
      const poseText = "ATOM  pose line\n"
      const fetchMock = vi.fn().mockResolvedValue(
        mockRes(200, {
          best_pose_pdbqt: btoa(poseText),
          binding_affinity_kcal_mol: -8.4,
          pose_scores_kcal_mol: [-8.4, -7.9, -7.1],
        }),
      )

      const outcome = await runDock(fetchMock as never, BASE_PARAMS)

      // endpoint + method
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe(DOCK_ENDPOINT)
      expect(init.method).toBe("POST")

      // body: receptor base64-encoded, box + params threaded
      const sent = JSON.parse(init.body)
      expect(sent.smiles).toBe(BASE_PARAMS.smiles)
      expect(atob(sent.receptor_pdbqt)).toBe(RAW_RECEPTOR)
      expect(sent.box).toEqual({ center: BASE_PARAMS.center, size: BASE_PARAMS.size })
      expect(sent.exhaustiveness).toBe(8)
      expect(sent.n_poses).toBe(5)

      // response decoded for the viewer
      expect(outcome.ok).toBe(true)
      if (outcome.ok) {
        expect(outcome.render.receptorText).toBe(RAW_RECEPTOR)
        expect(outcome.render.ligandText).toBe(poseText)
        expect(outcome.render.affinity).toBe(-8.4)
        expect(outcome.render.poseScores).toEqual([-8.4, -7.9, -7.1])
      }
    })

    it("defaults poseScores to [] when omitted", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockRes(200, { best_pose_pdbqt: btoa("X"), binding_affinity_kcal_mol: -5 }),
      )
      const outcome = await runDock(fetchMock as never, BASE_PARAMS)
      expect(outcome.ok && outcome.render.poseScores).toEqual([])
    })
  })

  describe("runDock — validation + error branches", () => {
    it("rejects missing receptor/smiles without calling fetch", async () => {
      const fetchMock = vi.fn()
      const outcome = await runDock(fetchMock as never, { ...BASE_PARAMS, smiles: "" })
      expect(fetchMock).not.toHaveBeenCalled()
      expect(outcome).toEqual({ ok: false, error: expect.stringContaining("receptor") })
    })

    it("maps 404 to the sidecar-disabled message", async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockRes(404, { error: "Not found" }))
      const outcome = await runDock(fetchMock as never, BASE_PARAMS)
      expect(outcome).toEqual({ ok: false, error: SIDECAR_DISABLED_MESSAGE })
    })

    it("maps 401 to a session error", async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockRes(401, {}))
      const outcome = await runDock(fetchMock as never, BASE_PARAMS)
      expect(outcome.ok).toBe(false)
      if (!outcome.ok) expect(outcome.error).toMatch(/sign in/i)
    })

    it("surfaces a server error message on non-ok responses", async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockRes(502, { error: "Vina crashed" }))
      const outcome = await runDock(fetchMock as never, BASE_PARAMS)
      expect(outcome).toEqual({ ok: false, error: "Vina crashed" })
    })

    it("falls back to a generic HTTP message when body has no error", async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockRes(500, {}))
      const outcome = await runDock(fetchMock as never, BASE_PARAMS)
      expect(outcome.ok).toBe(false)
      if (!outcome.ok) expect(outcome.error).toContain("500")
    })

    it("handles a network throw gracefully", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("network down"))
      const outcome = await runDock(fetchMock as never, BASE_PARAMS)
      expect(outcome).toEqual({ ok: false, error: "network down" })
    })
  })
})
