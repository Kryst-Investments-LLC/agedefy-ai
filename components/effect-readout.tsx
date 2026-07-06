/**
 * Measured-effect readout — closes the loop visibly.
 *
 * Shows the observed biomarker changes from the latest completed protocol cycle,
 * colored by whether each moved in the improving direction (down for HbA1c/LDL/
 * hs-CRP, up for HDL/VO2max, …). This is the real causal payoff, not a proxy.
 */

import { ArrowDown, ArrowUp, Minus, TrendingUp } from 'lucide-react'

import { improvementDirection } from '@/lib/biomarkers/reference-ranges'
import type { LatestEffect } from '@/lib/outcomes/latest-effect'

function fmtDelta(d: number) {
  const s = Math.abs(d) >= 10 ? Math.round(Math.abs(d)).toString() : Math.abs(d).toFixed(1)
  return (d > 0 ? '+' : d < 0 ? '−' : '±') + s
}

export function EffectReadout({ effect }: { effect: LatestEffect }) {
  const start = new Date(effect.cycleStartDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const end = effect.cycleEndDate
    ? new Date(effect.cycleEndDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'now'

  const improvedCount = effect.observed.filter((o) => {
    const dir = improvementDirection(o.name)
    return dir && o.observedDirection === dir
  }).length

  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          <h2 className="text-lg font-semibold">Measured effect</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {effect.protocolName ? `${effect.protocolName} · ` : ''}
          {start} → {end}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {effect.observed.length > 0
          ? `${improvedCount} of ${effect.observed.length} tracked markers moved in the improving direction over this cycle.`
          : 'This cycle completed but no paired before/after readings were available to measure change.'}
      </p>

      {effect.observed.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {effect.observed.map((o) => {
            const goodDir = improvementDirection(o.name)
            const improved = goodDir ? o.observedDirection === goodDir : null
            const tone =
              improved === true
                ? 'text-green-700 dark:text-green-300'
                : improved === false
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-muted-foreground'
            const Icon = o.observedDirection === 'up' ? ArrowUp : o.observedDirection === 'down' ? ArrowDown : Minus
            return (
              <li key={o.name} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-sm font-medium">{o.name}</span>
                <span className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${tone}`}>
                    <Icon className="h-4 w-4" />
                    {fmtDelta(o.observedDelta)}
                  </span>
                  {improved !== null && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        improved
                          ? 'bg-green-500/15 text-green-700 dark:text-green-300'
                          : 'bg-red-500/15 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {improved ? 'improved' : 'worsened'}
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {(effect.overallEfficacy != null || effect.twinPredictionAccuracy != null) && (
        <div className="mt-4 flex flex-wrap gap-4 border-t pt-4 text-sm">
          {effect.overallEfficacy != null && (
            <div>
              <p className="text-xs text-muted-foreground">Overall efficacy</p>
              <p className="font-semibold tabular-nums">{Math.round(effect.overallEfficacy * 100)}%</p>
            </div>
          )}
          {effect.twinPredictionAccuracy != null && (
            <div>
              <p className="text-xs text-muted-foreground">Digital-twin prediction accuracy</p>
              <p className="font-semibold tabular-nums">{Math.round(effect.twinPredictionAccuracy * 100)}%</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
