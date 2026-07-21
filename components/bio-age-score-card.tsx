"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, RefreshCw } from "lucide-react"

import { BioAgeGauge } from "@/components/viz/bio-age-gauge"
import { HallmarksRadar, type HallmarkDatum } from "@/components/viz/hallmarks-radar"

interface HallmarkScores {
  genomicInstability: number
  telomereDysfunction: number
  epigeneticAlteration: number
  lossOfProteostasis: number
  disabledMacroautophagy: number
  mitochondrialDysfunction: number
  cellularSenescence: number
  stemCellExhaustion: number
  alteredIntercellularCommunication: number
}

interface BioAgeSnapshot {
  id: string
  biologicalAge: number
  chronologicalAge: number
  delta: number
  hallmarkScores: HallmarkScores
  confidence: number
  createdAt: string
}

const HALLMARK_LABELS: Record<keyof HallmarkScores, string> = {
  genomicInstability: "Genomic Instability",
  telomereDysfunction: "Telomere Dysfunction",
  epigeneticAlteration: "Epigenetic Alteration",
  lossOfProteostasis: "Loss of Proteostasis",
  disabledMacroautophagy: "Disabled Macroautophagy",
  mitochondrialDysfunction: "Mitochondrial Dysfunction",
  cellularSenescence: "Cellular Senescence",
  stemCellExhaustion: "Stem Cell Exhaustion",
  alteredIntercellularCommunication: "Altered Intercellular Communication",
}

// Worst three hallmarks surface as focus areas beneath the radar.
function topFocusAreas(scores: HallmarkScores): { label: string; pct: number }[] {
  return (Object.keys(HALLMARK_LABELS) as Array<keyof HallmarkScores>)
    .map((k) => ({ label: HALLMARK_LABELS[k], pct: Math.round((scores[k] ?? 0) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3)
}

export function BioAgeScoreCard() {
  const [latest, setLatest] = useState<BioAgeSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLatest = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/bio-age?limit=1")
      if (!res.ok) throw new Error("Failed to fetch bio-age data")
      const data = await res.json()
      setLatest(data.latest ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLatest()
  }, [fetchLatest])

  const handleCompute = async () => {
    const ageInput = prompt("Enter your chronological age:")
    if (!ageInput) return
    const age = parseInt(ageInput, 10)
    if (isNaN(age) || age < 1 || age > 150) {
      setError("Please enter a valid age between 1 and 150")
      return
    }

    try {
      setComputing(true)
      setError(null)
      const res = await fetch("/api/bio-age", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chronologicalAge: age }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      await fetchLatest()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Computation failed")
    } finally {
      setComputing(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6 animate-pulse">
        <div className="h-6 w-40 bg-muted rounded mb-4" />
        <div className="h-40 bg-muted rounded" />
      </div>
    )
  }

  const radarData: HallmarkDatum[] = latest
    ? (Object.keys(HALLMARK_LABELS) as Array<keyof HallmarkScores>).map((k) => ({
        key: k,
        label: HALLMARK_LABELS[k],
        score: latest.hallmarkScores[k] ?? 0,
      }))
    : []

  return (
    <div className="rounded-lg border bg-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Biological Age</h3>
        </div>
        <button
          onClick={handleCompute}
          disabled={computing}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${computing ? "animate-spin" : ""}`} />
          {computing ? "Computing…" : latest ? "Recalculate" : "Calculate"}
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {latest ? (
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <BioAgeGauge
            biologicalAge={latest.biologicalAge}
            chronologicalAge={latest.chronologicalAge}
            delta={latest.delta}
            confidence={latest.confidence}
          />
          <div>
            <h4 className="mb-1 text-sm font-medium">Hallmarks of aging</h4>
            <HallmarksRadar data={radarData} />
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground">Top focus areas</p>
              <ul className="mt-1 space-y-1">
                {topFocusAreas(latest.hallmarkScores).map((f) => (
                  <li key={f.label} className="flex items-center justify-between text-xs">
                    <span>{f.label}</span>
                    <span className="tabular-nums text-muted-foreground">{f.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">
            Last computed {new Date(latest.createdAt).toLocaleDateString()} · lower hallmark scores are better.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No biological age data yet. Click &quot;Calculate&quot; to compute your first score
          from your biomarker data.
        </p>
      )}
    </div>
  )
}
