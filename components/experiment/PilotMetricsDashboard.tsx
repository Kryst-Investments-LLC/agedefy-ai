'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2, TrendingUp, DollarSign, Clock, Target } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── API response shape (mirrors PilotMetrics from pilot-metrics.ts) ──────────

interface HitRateUplift {
  alHitRate: number
  baselineHitRate: number
  uplift: number
  alN: number
  baselineN: number
}

interface CostMetrics {
  totalSpendCents: number
  validatedHits: number
  costPerHitCents: number | null
}

interface CycleTimeMetrics {
  medianCycleTimeSec: number | null
  p75CycleTimeSec: number | null
  stageTimes: {
    proposedToScreened: number | null
    screenedToSent: number | null
    sentToLogged: number | null
    loggedToFed: number | null
  }
  n: number
}

interface ClassificationMetrics {
  screenPositives: number
  screenNegatives: number
  falsePositiveRate: number | null
  falseNegativeRate: number | null
}

interface PilotMetricsResponse {
  hitRateUplift: HitRateUplift
  cost: CostMetrics
  cycleTime: CycleTimeMetrics
  classification: ClassificationMetrics
  insufficientData: boolean
  computedAt: string
  windowDays: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number | null, precision = 1): string {
  if (v === null) return '—'
  return `${(v * 100).toFixed(precision)}%`
}

function dollars(cents: number | null): string {
  if (cents === null) return '—'
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function days(sec: number | null): string {
  if (sec === null) return '—'
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`
  return `${(sec / 86400).toFixed(1)}d`
}

function upliftColor(uplift: number): string {
  if (uplift > 0.05) return 'text-emerald-600'
  if (uplift < -0.05) return 'text-red-500'
  return 'text-slate-500'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricTile({
  icon,
  label,
  primary,
  secondary,
  footer,
  accent,
}: {
  icon: React.ReactNode
  label: string
  primary: string
  secondary?: string
  footer?: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-3xl font-bold tabular-nums ${accent ?? 'text-slate-900'}`}>{primary}</div>
      {secondary && <div className="mt-1 text-sm text-slate-500">{secondary}</div>}
      {footer && <div className="mt-3 text-xs text-slate-400">{footer}</div>}
    </div>
  )
}

function StageBar({ label, sec }: { label: string; sec: number | null }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-mono text-slate-800">{days(sec)}</span>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

interface Props {
  windowDays?: number
}

export function PilotMetricsDashboard({ windowDays = 90 }: Props) {
  const [data, setData] = useState<PilotMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/experiment/pilot-metrics?windowDays=${windowDays}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server error ${res.status}`)
        return res.json() as Promise<PilotMetricsResponse>
      })
      .then((d) => { setData(d); setLoading(false) })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load metrics')
        setLoading(false)
      })
  }, [windowDays])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Computing pilot metrics…
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  if (data.insufficientData) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
        <Target className="mx-auto mb-3 h-8 w-8 opacity-40" />
        <p className="font-medium">No FED_BACK candidates yet</p>
        <p className="mt-1 text-sm">Metrics will appear once candidates complete the full lab cycle.</p>
      </div>
    )
  }

  const { hitRateUplift, cost, cycleTime, classification } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Pilot Metrics</h2>
        <span className="text-xs text-slate-400">
          {windowDays}-day window · computed {new Date(data.computedAt).toLocaleString()}
        </span>
      </div>

      {/* ── Row 1: hit-rate uplift + cost ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricTile
          icon={<TrendingUp className="h-4 w-4" />}
          label="Hit-rate uplift"
          primary={pct(hitRateUplift.uplift, 1)}
          accent={upliftColor(hitRateUplift.uplift)}
          secondary={`AL ${pct(hitRateUplift.alHitRate, 0)} vs. baseline ${pct(hitRateUplift.baselineHitRate, 0)}`}
          footer={`AL n=${hitRateUplift.alN} · baseline n=${hitRateUplift.baselineN}`}
        />
        <MetricTile
          icon={<DollarSign className="h-4 w-4" />}
          label="Cost per validated hit"
          primary={dollars(cost.costPerHitCents)}
          secondary={`${cost.validatedHits} validated hit${cost.validatedHits !== 1 ? 's' : ''}`}
          footer={`Total spend ${dollars(cost.totalSpendCents * 100)} across linked deals`}
        />
      </div>

      {/* ── Row 2: cycle time + FP/FN ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-slate-500">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Cycle time</span>
            {cycleTime.n > 0 && (
              <span className="ml-auto text-xs text-slate-400">n={cycleTime.n}</span>
            )}
          </div>
          {cycleTime.medianCycleTimeSec === null ? (
            <p className="text-sm text-slate-400">Need ≥3 FED_BACK candidates for percentiles</p>
          ) : (
            <>
              <div className="text-3xl font-bold tabular-nums text-slate-900">
                {days(cycleTime.medianCycleTimeSec)}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                median · p75 {days(cycleTime.p75CycleTimeSec)}
              </div>
            </>
          )}
          <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100 pt-3">
            <StageBar label="Proposed → Screened" sec={cycleTime.stageTimes.proposedToScreened} />
            <StageBar label="Screened → Sent to lab" sec={cycleTime.stageTimes.screenedToSent} />
            <StageBar label="Sent → Result logged" sec={cycleTime.stageTimes.sentToLogged} />
            <StageBar label="Result logged → Fed back" sec={cycleTime.stageTimes.loggedToFed} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-slate-500">
            <Target className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Screening accuracy</span>
          </div>
          {classification.falsePositiveRate === null && classification.falseNegativeRate === null ? (
            <p className="text-sm text-slate-400">
              Need candidates with screenJson QED data and lab results
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">False-positive rate</span>
                <span className="font-mono font-semibold text-slate-900">
                  {pct(classification.falsePositiveRate)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">False-negative rate</span>
                <span className="font-mono font-semibold text-slate-900">
                  {pct(classification.falseNegativeRate)}
                </span>
              </div>
              <div className="border-t border-slate-100 pt-2 text-xs text-slate-400">
                Screen+ {classification.screenPositives} · screen− {classification.screenNegatives}
                <br />
                Threshold: QED ≥ 0.4 (Bickerton 2012)
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
