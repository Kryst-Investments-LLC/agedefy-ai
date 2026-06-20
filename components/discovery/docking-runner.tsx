"use client"

import { useState } from "react"
import dynamic from "next/dynamic"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { runDock, type DockRenderState } from "@/lib/discovery/docking-wiring"

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

/**
 * Live docking runner. Sends a prepared receptor + ligand SMILES + box to
 * POST /api/agents/chemistry/dock (AutoDock Vina via the screening sidecar) and
 * renders the returned best pose in the 3D docking viewer. The request/response
 * wiring lives in lib/discovery/docking-wiring.ts (and is integration-tested).
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
  const [render, setRender] = useState<DockRenderState | null>(null)

  async function runDocking() {
    setError(null)
    setRunning(true)
    setRender(null)
    const outcome = await runDock(fetch as never, {
      receptor, smiles, center, size, exhaustiveness, nPoses,
    })
    if (outcome.ok && outcome.render) setRender(outcome.render)
    else setError(outcome.error ?? "Docking failed.")
    setRunning(false)
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
