"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { GLViewer } from "3dmol"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type ViewerStyle = "stick" | "sphere" | "ballAndStick" | "line"

interface MolecularViewerProps {
  /** SMILES string for the molecule to render */
  smiles?: string
  /** PubChem CID (alternative to SMILES) */
  pubChemCid?: string
  /** Compound name to resolve via PubChem (fallback when no SMILES/CID) */
  compoundName?: string
  /** Optional molecule name for the header */
  name?: string
  /** Height of the 3D viewer container */
  height?: number
  /** Additional CSS class names */
  className?: string
  /** Show style toggle controls */
  showControls?: boolean
}

/** PubChem URL to convert SMILES → SDF (3D coordinates) */
function buildPubChemSdfUrl(smiles: string): string {
  return `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/SDF?record_type=3d`
}

/** Fallback: PubChem 2D SDF if 3D is unavailable */
function buildPubChemSdf2dUrl(smiles: string): string {
  return `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/SDF?record_type=2d`
}

/** PubChem URL to look up compound by name → SDF (3D coordinates) */
function buildPubChemNameSdfUrl(compoundName: string): string {
  return `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(compoundName)}/SDF?record_type=3d`
}

/** PubChem URL to look up compound by CID → SDF (3D coordinates) */
function buildPubChemCidSdfUrl(cid: string): string {
  return `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${encodeURIComponent(cid)}/SDF?record_type=3d`
}

const STYLE_LABELS: Record<ViewerStyle, string> = {
  stick: "Stick",
  sphere: "Sphere",
  ballAndStick: "Ball & Stick",
  line: "Line",
}

function applyStyle(viewer: GLViewer, style: ViewerStyle) {
  viewer.removeAllModels()
  // We need to re-add models after removing, so this function is called
  // from the effect that already has the model data. Instead, we'll apply
  // style to existing atoms.
  switch (style) {
    case "stick":
      viewer.setStyle({}, { stick: { radius: 0.15, colorscheme: "Jmol" } })
      break
    case "sphere":
      viewer.setStyle({}, { sphere: { scale: 0.3, colorscheme: "Jmol" } })
      break
    case "ballAndStick":
      viewer.setStyle(
        {},
        {
          stick: { radius: 0.1, colorscheme: "Jmol" },
          sphere: { scale: 0.25, colorscheme: "Jmol" },
        },
      )
      break
    case "line":
      viewer.setStyle({}, { line: { colorscheme: "Jmol" } })
      break
  }
  viewer.render()
}

export function MolecularViewer({
  smiles,
  pubChemCid,
  compoundName,
  name,
  height = 350,
  className,
  showControls = true,
}: MolecularViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<GLViewer | null>(null)
  const [style, setStyle] = useState<ViewerStyle>("ballAndStick")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const identifier = smiles ?? pubChemCid ?? compoundName

  const initViewer = useCallback(async () => {
    if (!containerRef.current || !identifier) return

    setLoading(true)
    setError(null)

    // Dynamically import 3Dmol to avoid SSR issues
    const $3Dmol = await import("3dmol")

    // Clean up previous viewer
    if (viewerRef.current) {
      viewerRef.current.clear()
      containerRef.current.innerHTML = ""
    }

    const viewer = $3Dmol.createViewer(containerRef.current, {
      backgroundColor: "0x1a1a2e",
      antialias: true,
    })
    viewerRef.current = viewer

    try {
      let sdfData: string | null = null

      // Build fetch URL chain based on which identifier we have
      const urlsToTry: string[] = []
      if (smiles) {
        urlsToTry.push(buildPubChemSdfUrl(smiles), buildPubChemSdf2dUrl(smiles))
      } else if (pubChemCid) {
        urlsToTry.push(buildPubChemCidSdfUrl(pubChemCid))
      } else if (compoundName) {
        urlsToTry.push(buildPubChemNameSdfUrl(compoundName))
      }

      for (const url of urlsToTry) {
        if (sdfData) break
        try {
          const res = await fetch(url)
          if (res.ok) {
            const text = await res.text()
            if (text.length > 10) sdfData = text
          }
        } catch {
          // try next URL
        }
      }

      if (sdfData) {
        viewer.addModel(sdfData, "sdf")
      } else if (smiles) {
        // Last resort: use SMILES directly (3Dmol can parse basic SMILES)
        viewer.addModel(smiles, "smi")
      } else {
        setError("No 3D structure found for this compound")
        setLoading(false)
        return
      }

      applyStyle(viewer, style)
      viewer.zoomTo()
      viewer.render()
      viewer.zoom(0.8)
      viewer.render()
    } catch {
      setError("Unable to render this molecule")
    } finally {
      setLoading(false)
    }
  }, [identifier]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    initViewer()

    return () => {
      if (viewerRef.current) {
        viewerRef.current.clear()
        viewerRef.current = null
      }
    }
  }, [initViewer])

  // Apply style change without re-fetching
  useEffect(() => {
    if (viewerRef.current && !loading) {
      applyStyle(viewerRef.current, style)
    }
  }, [style, loading])

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{name ?? "Molecular Structure"}</span>
          <Badge variant="outline" className="text-xs font-mono">
            SMILES
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <div
            ref={containerRef}
            style={{ height, width: "100%" }}
            className="bg-[#1a1a2e]"
          />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]/80">
              <p className="text-sm text-gray-400 animate-pulse">
                Loading 3D structure…
              </p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]/90">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {showControls && (
          <div className="flex items-center gap-1 p-2 border-t border-gray-200 dark:border-slate-800">
            {(Object.keys(STYLE_LABELS) as ViewerStyle[]).map((s) => (
              <Button
                key={s}
                variant={style === s ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7"
                onClick={() => setStyle(s)}
              >
                {STYLE_LABELS[s]}
              </Button>
            ))}
          </div>
        )}

        {smiles && (
          <p className="px-3 pb-2 text-[10px] text-muted-foreground font-mono truncate">
            {smiles}
          </p>
        )}
        {!smiles && (pubChemCid || compoundName) && (
          <p className="px-3 pb-2 text-[10px] text-muted-foreground font-mono truncate">
            {pubChemCid ? `PubChem CID: ${pubChemCid}` : compoundName}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
