"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Minus,
  RefreshCw,
} from "lucide-react"

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

function DeltaIndicator({ delta }: { delta: number }) {
  if (delta < -0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
        <ArrowDown className="h-4 w-4" />
        {Math.abs(delta).toFixed(1)} years younger
      </span>
    )
  }
  if (delta > 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
        <ArrowUp className="h-4 w-4" />
        {delta.toFixed(1)} years older
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground font-semibold">
      <Minus className="h-4 w-4" />
      On target
    </span>
  )
}

function HallmarkBar({ label, score }: { label: string; score: number }) {
  const pct = Math.round(score * 100)
  const color =
    score <= 0.3
      ? "bg-green-500"
      : score <= 0.6
        ? "bg-yellow-500"
        : "bg-red-500"

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
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
        <div className="h-16 w-24 bg-muted rounded" />
      </div>
    )
  }

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

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {latest ? (
        <>
          <div className="flex items-baseline gap-4">
            <span className="text-5xl font-bold tabular-nums">
              {latest.biologicalAge.toFixed(1)}
            </span>
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">
                Chronological: {latest.chronologicalAge.toFixed(0)}
              </p>
              <DeltaIndicator delta={latest.delta} />
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Confidence: {Math.round(latest.confidence * 100)}% · Last computed:{" "}
            {new Date(latest.createdAt).toLocaleDateString()}
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-medium">Hallmark Aging Scores</h4>
            {(Object.keys(HALLMARK_LABELS) as Array<keyof HallmarkScores>).map(
              (key) => (
                <HallmarkBar
                  key={key}
                  label={HALLMARK_LABELS[key]}
                  score={latest.hallmarkScores[key]}
                />
              )
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No biological age data yet. Click &quot;Calculate&quot; to compute your first score
          from your biomarker data.
        </p>
      )}
    </div>
  )
}
