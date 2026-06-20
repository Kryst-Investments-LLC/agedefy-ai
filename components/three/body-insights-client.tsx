"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  type ClassifiedBiomarker,
  type OrganSummary,
  type OrganSystem,
  type BiomarkerStatus,
  organLabel,
} from "@/lib/biomarkers/organ-mapping"

// WebGL components are client-only — never SSR them.
const AnatomyViewer = dynamic(
  () => import("./anatomy-viewer").then((m) => m.AnatomyViewer),
  { ssr: false, loading: () => <ViewerSkeleton label="Loading 3D body…" /> },
)
const Biomarker3DDashboard = dynamic(
  () => import("./biomarker-3d-dashboard").then((m) => m.Biomarker3DDashboard),
  { ssr: false, loading: () => <ViewerSkeleton label="Loading 3D dashboard…" /> },
)

function ViewerSkeleton({ label }: { label: string }) {
  return (
    <div className="flex h-[460px] w-full items-center justify-center rounded-lg bg-[#0b1020]">
      <p className="animate-pulse text-sm text-gray-400">{label}</p>
    </div>
  )
}

const STATUS_BADGE: Record<BiomarkerStatus, { label: string; className: string }> = {
  optimal:      { label: "Optimal",      className: "bg-green-600 text-white" },
  borderline:   { label: "Borderline",   className: "bg-amber-500 text-white" },
  out_of_range: { label: "Out of range", className: "bg-red-600 text-white" },
  unknown:      { label: "No range",     className: "bg-slate-500 text-white" },
}

interface BodyInsightsClientProps {
  biomarkers: ClassifiedBiomarker[]
  organs: OrganSummary[]
}

export function BodyInsightsClient({ biomarkers, organs }: BodyInsightsClientProps) {
  const [tab, setTab] = useState<"body" | "dashboard">("body")
  const [selected, setSelected] = useState<OrganSystem | null>(organs[0]?.organ ?? null)

  const selectedSummary = useMemo(
    () => organs.find((o) => o.organ === selected) ?? null,
    [organs, selected],
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {/* View toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("body")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === "body" ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            3D Body
          </button>
          <button
            onClick={() => setTab("dashboard")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === "dashboard" ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            3D Dashboard
          </button>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <LegendDot color="bg-green-500" label="Optimal" />
            <LegendDot color="bg-amber-500" label="Borderline" />
            <LegendDot color="bg-red-500" label="Out of range" />
          </div>
        </div>

        {biomarkers.length === 0 ? (
          <ViewerSkeleton label="No biomarkers yet — add lab results to populate your 3D view." />
        ) : tab === "body" ? (
          <AnatomyViewer organs={organs} selected={selected} onSelect={setSelected} />
        ) : (
          <Biomarker3DDashboard biomarkers={biomarkers} />
        )}

        <p className="text-[11px] text-muted-foreground">
          Research visualization of your own biomarkers — descriptive only, not a diagnosis.
          Status bands are coarse reference ranges. Consult a qualified clinician for medical advice.
        </p>
      </div>

      {/* Organ detail panel */}
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {selectedSummary ? organLabel(selectedSummary.organ) : "Select an organ"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedSummary ? (
            <>
              <Badge className={STATUS_BADGE[selectedSummary.status].className}>
                {STATUS_BADGE[selectedSummary.status].label}
              </Badge>
              <ul className="space-y-2">
                {selectedSummary.biomarkers.map((b) => (
                  <li key={b.name} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{b.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">
                        {b.value}
                        {b.unit ? ` ${b.unit}` : ""}
                      </span>
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          b.status === "optimal"
                            ? "bg-green-500"
                            : b.status === "borderline"
                            ? "bg-amber-500"
                            : b.status === "out_of_range"
                            ? "bg-red-500"
                            : "bg-slate-500"
                        }`}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click an organ in the 3D body to see its biomarkers.
            </p>
          )}

          {/* Organ list */}
          <div className="mt-4 space-y-1 border-t pt-3">
            {organs.map((o) => (
              <button
                key={o.organ}
                onClick={() => setSelected(o.organ)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition ${
                  selected === o.organ ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <span>{organLabel(o.organ)}</span>
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    o.status === "optimal"
                      ? "bg-green-500"
                      : o.status === "borderline"
                      ? "bg-amber-500"
                      : o.status === "out_of_range"
                      ? "bg-red-500"
                      : "bg-slate-500"
                  }`}
                />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  )
}
