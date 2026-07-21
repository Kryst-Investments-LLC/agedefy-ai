"use client"

import { useState } from "react"
import dynamic from "next/dynamic"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const DockingViewer = dynamic(
  () => import("./docking-viewer").then((m) => m.DockingViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-lg bg-[#0b1020]">
        <p className="animate-pulse text-sm text-muted-foreground">Loading docking viewer…</p>
      </div>
    ),
  },
)

const PRESETS: Array<{ label: string; pdbId: string; note: string }> = [
  { label: "HIV-1 protease + indinavir", pdbId: "1HSG", note: "Classic protease–inhibitor complex" },
  { label: "COX-2 + ligand", pdbId: "5KIR", note: "Cyclooxygenase-2" },
  { label: "Estrogen receptor", pdbId: "1ERE", note: "ER ligand-binding domain" },
]

export function DockingExplorer() {
  const [pdbId, setPdbId] = useState("1HSG")
  const [ligandSmiles, setLigandSmiles] = useState("")
  const [active, setActive] = useState({ pdbId: "1HSG", ligandSmiles: "" })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="space-y-1">
          <Label htmlFor="pdb" className="text-xs">RCSB PDB ID</Label>
          <Input
            id="pdb"
            value={pdbId}
            onChange={(e) => setPdbId(e.target.value.trim())}
            placeholder="1HSG"
            className="w-28 font-mono"
            maxLength={4}
          />
        </div>
        <div className="space-y-1 flex-1 min-w-[220px]">
          <Label htmlFor="smiles" className="text-xs">Docked ligand SMILES (optional)</Label>
          <Input
            id="smiles"
            value={ligandSmiles}
            onChange={(e) => setLigandSmiles(e.target.value)}
            placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O"
            className="font-mono"
          />
        </div>
        <Button onClick={() => setActive({ pdbId, ligandSmiles })}>Render</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.pdbId}
            onClick={() => {
              setPdbId(p.pdbId)
              setLigandSmiles("")
              setActive({ pdbId: p.pdbId, ligandSmiles: "" })
            }}
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            title={p.note}
          >
            {p.label}
          </button>
        ))}
      </div>

      <DockingViewer
        pdbId={active.pdbId || undefined}
        ligandSmiles={active.ligandSmiles || undefined}
        name={`Receptor ${active.pdbId.toUpperCase()}`}
        height={460}
      />
    </div>
  )
}
