"use client"

import { useState } from "react"
import dynamic from "next/dynamic"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const DockingViewer = dynamic(
  () => import("./docking-viewer").then((m) => m.DockingViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-lg bg-[#0b1020]">
        <p className="animate-pulse text-sm text-gray-400">Loading viewer…</p>
      </div>
    ),
  },
)

interface DockResult {
  ligand_smiles: string
  binding_affinity_kcal_mol: number
  pose_scores_kcal_mol: number[]
  best_pose_pdbqt: string // base64 PDBQT
  n_poses_returned: number
  model_version: string
}

interface RenderState {
  receptorText: string
  ligandText: string
  affinity: number
  poseScores: number[]
}

/** Heuristic: looks like raw PDBQT text (vs. an already-base64 blob). */
function looksLikeRawPdbqt(s: string): boolean {
  return /\b(ATOM|HETATM|ROOT|BRANCH|REMARK)\b/.test(s)
}

/**
 * Live docking runner. Sends a prepared receptor + ligand SMILES + box to
 * POST /api/agents/chemistry/dock (AutoDock Vina via the screening sidecar) and
 * renders the returned best pose in the 3D docking viewer.
 *
 * Requires the screening sidecar to be enabled (ENABLE_SCREENING_SIDECAR=true)
 * and a researcher session.
 */
export function DockingRunner() {
  const [receptor, setReceptor] = useState("")
  const [smiles, setSmiles] = useState("")
  const [center, setCenter] = useState({ x: 0, y: 0, z: 0 })
  const [size, setSize] = useState({ x: 20, y: 20, z: 20 })
  const [exhaustiveness, setExhaustiveness] = useState(8)
  const [nPoses, setNPoses] = useState(5)

  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [render, setRender] = useState<RenderState | null>(null)

  async function runDocking() {
    setError(null)
    setRunning(true)
    setRender(null)
    try {
      const raw = receptor.trim()
      if (!raw || !smiles.trim()) {
        setError("Provide both a receptor (PDBQT) and a ligand SMILES.")
        return
      }
      const isRaw = looksLikeRawPdbqt(raw)
      const receptorBase64 = isRaw ? btoa(raw) : raw
      const receptorText = isRaw ? raw : atob(raw)

      const res = await fetch("/api/agents/chemistry/dock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          smiles: smiles.trim(),
          receptor_pdbqt: receptorBase64,
          box: { center, size },
          exhaustiveness,
          n_poses: nPoses,
        }),
      })

      if (res.status === 404) {
        setError(
          "Live docking is unavailable: the screening sidecar is not enabled (ENABLE_SCREENING_SIDECAR). Use the PDB Explorer to inspect existing structures, or enable the sidecar to run AutoDock Vina.",
        )
        return
      }
      if (res.status === 401) {
        setError("Your session expired — please sign in again.")
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Docking failed (HTTP ${res.status}).`)
        return
      }

      const result = (await res.json()) as DockResult
      let ligandText = ""
      try {
        ligandText = atob(result.best_pose_pdbqt)
      } catch {
        ligandText = result.best_pose_pdbqt
      }

      setRender({
        receptorText,
        ligandText,
        affinity: result.binding_affinity_kcal_mol,
        poseScores: result.pose_scores_kcal_mol ?? [],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Docking request failed.")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="receptor" className="text-xs">Receptor (PDBQT — raw text or base64)</Label>
          <Textarea
            id="receptor"
            value={receptor}
            onChange={(e) => setReceptor(e.target.value)}
            placeholder="Paste prepared receptor PDBQT…"
            className="h-28 font-mono text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="smiles" className="text-xs">Ligand SMILES</Label>
          <Input
            id="smiles"
            value={smiles}
            onChange={(e) => setSmiles(e.target.value)}
            placeholder="CC(=O)Oc1ccccc1C(=O)O"
            className="font-mono"
          />
        </div>

        <div className="flex gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Exhaustiveness</Label>
            <Input
              type="number" min={1} max={32} value={exhaustiveness}
              onChange={(e) => setExhaustiveness(Number(e.target.value))}
              className="w-24"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Poses</Label>
            <Input
              type="number" min={1} max={20} value={nPoses}
              onChange={(e) => setNPoses(Number(e.target.value))}
              className="w-20"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Box center (x, y, z Å)</Label>
          <div className="flex gap-2">
            {(["x", "y", "z"] as const).map((axis) => (
              <Input
                key={axis} type="number" value={center[axis]}
                onChange={(e) => setCenter({ ...center, [axis]: Number(e.target.value) })}
                className="w-20 font-mono"
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Box size (x, y, z Å)</Label>
          <div className="flex gap-2">
            {(["x", "y", "z"] as const).map((axis) => (
              <Input
                key={axis} type="number" min={1} value={size[axis]}
                onChange={(e) => setSize({ ...size, [axis]: Number(e.target.value) })}
                className="w-20 font-mono"
              />
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <Button onClick={runDocking} disabled={running}>
            {running ? "Docking… (15–300 s)" : "Run AutoDock Vina"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {error}
        </div>
      )}

      {render && (
        <DockingViewer
          receptorPdb={render.receptorText}
          receptorFormat="pdbqt"
          ligandSdf={render.ligandText}
          ligandFormat="pdbqt"
          affinityKcalMol={render.affinity}
          poseScores={render.poseScores}
          name="Docked pose (AutoDock Vina)"
          height={460}
        />
      )}
    </div>
  )
}
