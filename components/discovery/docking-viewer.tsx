"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { GLViewer } from "3dmol"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type ProteinStyle = "cartoon" | "surface" | "stick"

interface DockingViewerProps {
  /** 4-letter RCSB PDB id for the receptor protein, e.g. "1HSG". */
  pdbId?: string
  /** Raw PDB/PDBQT text for the receptor (alternative to pdbId). */
  receptorPdb?: string
  /** 3Dmol format of `receptorPdb` (default "pdb"; use "pdbqt" for Vina output). */
  receptorFormat?: string
  /** Docked ligand pose as SDF/MOL2/PDB/PDBQT text. */
  ligandSdf?: string
  /** 3Dmol format of `ligandSdf` (default "sdf"; use "pdbqt" for Vina poses). */
  ligandFormat?: string
  /** Ligand SMILES — falls back to fetching a 3D conformer from PubChem. */
  ligandSmiles?: string
  /** Predicted binding affinity (kcal/mol) to display. */
  affinityKcalMol?: number
  /** Per-pose Vina scores (kcal/mol) to list. */
  poseScores?: number[]
  /** Header label. */
  name?: string
  height?: number
  className?: string
}

function buildRcsbPdbUrl(pdbId: string): string {
  return `https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`
}

function buildPubChemSdfUrl(smiles: string): string {
  return `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/SDF?record_type=3d`
}

/**
 * 3D protein–ligand docking viewer. Renders the receptor (cartoon/surface) with
 * the docked ligand pose highlighted as sticks, and surfaces the predicted
 * affinity. Computational docking pose — requires experimental validation.
 */
export function DockingViewer({
  pdbId,
  receptorPdb,
  receptorFormat = "pdb",
  ligandSdf,
  ligandFormat = "sdf",
  ligandSmiles,
  affinityKcalMol,
  poseScores,
  name,
  height = 420,
  className,
}: DockingViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<GLViewer | null>(null)
  const [proteinStyle, setProteinStyle] = useState<ProteinStyle>("cartoon")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const identifier = pdbId ?? receptorPdb ?? "none"

  const applyProteinStyle = useCallback((viewer: GLViewer, style: ProteinStyle) => {
    viewer.setStyle({ hetflag: false }, {})
    if (style === "cartoon") {
      viewer.setStyle({ hetflag: false }, { cartoon: { color: "spectrum" } })
    } else if (style === "stick") {
      viewer.setStyle({ hetflag: false }, { stick: { radius: 0.12, colorscheme: "chain" } })
    } else {
      viewer.setStyle({ hetflag: false }, { cartoon: { color: "spectrum", opacity: 0.6 } })
      viewer.addSurface("VDW", { opacity: 0.55, color: "white" }, { hetflag: false })
    }
    viewer.render()
  }, [])

  const init = useCallback(async () => {
    if (!containerRef.current) return
    setLoading(true)
    setError(null)

    const $3Dmol = await import("3dmol")

    if (viewerRef.current) {
      viewerRef.current.clear()
      containerRef.current.innerHTML = ""
    }

    const viewer = $3Dmol.createViewer(containerRef.current, {
      backgroundColor: "0x0b1020",
      antialias: true,
    })
    viewerRef.current = viewer

    try {
      // ── Receptor ────────────────────────────────────────────────────────
      let receptorText = receptorPdb ?? null
      if (!receptorText && pdbId) {
        const res = await fetch(buildRcsbPdbUrl(pdbId))
        if (res.ok) receptorText = await res.text()
      }
      if (!receptorText) {
        setError("No receptor structure available")
        setLoading(false)
        return
      }
      viewer.addModel(receptorText, receptorFormat)
      applyProteinStyle(viewer, proteinStyle)

      // Always surface any co-crystallized ligand (HET atoms) in the receptor.
      viewer.setStyle({ hetflag: true }, { stick: { radius: 0.2, colorscheme: "greenCarbon" } })

      // ── Separately-supplied docked ligand pose ────────────────────────────
      let ligandText = ligandSdf ?? null
      let ligandFmt = ligandFormat
      if (!ligandText && ligandSmiles) {
        const res = await fetch(buildPubChemSdfUrl(ligandSmiles))
        if (res.ok) { ligandText = await res.text(); ligandFmt = "sdf" }
      }
      if (ligandText) {
        const ligand = viewer.addModel(ligandText, ligandFmt)
        ligand.setStyle({}, { stick: { radius: 0.22, colorscheme: "greenCarbon" } })
        // glow sphere around the binding site
        viewer.addStyle({ model: -1 }, { sphere: { scale: 0.25, opacity: 0.5 } })
      }

      viewer.zoomTo(ligandText ? { model: -1 } : {})
      viewer.zoom(ligandText ? 0.35 : 0.9)
      viewer.render()
    } catch {
      setError("Unable to render docking pose")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier, ligandSdf, ligandSmiles, receptorFormat, ligandFormat])

  useEffect(() => {
    init()
    return () => {
      if (viewerRef.current) {
        viewerRef.current.clear()
        viewerRef.current = null
      }
    }
  }, [init])

  useEffect(() => {
    if (viewerRef.current && !loading) applyProteinStyle(viewerRef.current, proteinStyle)
  }, [proteinStyle, loading, applyProteinStyle])

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{name ?? "Protein–Ligand Docking"}</span>
          <div className="flex items-center gap-2">
            {typeof affinityKcalMol === "number" && (
              <Badge variant="outline" className="font-mono text-xs">
                ΔG {affinityKcalMol.toFixed(1)} kcal/mol
              </Badge>
            )}
            {pdbId && (
              <Badge variant="outline" className="font-mono text-xs">PDB {pdbId.toUpperCase()}</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <div ref={containerRef} style={{ height, width: "100%" }} className="bg-[#0b1020]" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0b1020]/80">
              <p className="text-sm text-gray-400 animate-pulse">Loading docking pose…</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0b1020]/90">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 p-2 border-t border-gray-200 dark:border-slate-800">
          {(["cartoon", "surface", "stick"] as ProteinStyle[]).map((s) => (
            <Button
              key={s}
              variant={proteinStyle === s ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7 capitalize"
              onClick={() => setProteinStyle(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        {poseScores && poseScores.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
            <span className="text-[10px] text-muted-foreground">Pose scores:</span>
            {poseScores.map((s, i) => (
              <Badge key={i} variant="secondary" className="font-mono text-[10px]">
                {s.toFixed(1)}
              </Badge>
            ))}
          </div>
        )}
        <p className="px-3 pb-2 text-[10px] text-muted-foreground">
          Computational docking pose — AI/physics estimate, requires experimental validation. Not medical advice.
        </p>
      </CardContent>
    </Card>
  )
}
