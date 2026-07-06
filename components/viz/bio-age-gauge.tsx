'use client'

/**
 * Biological Age gauge — the hero metric.
 *
 * A 180° semicircular gauge. The scale is centered on chronological age
 * (±12 yrs); the fill and marker sit at biological age. Younger-than-chrono is
 * good (green), older is serious (red), within ±0.5 yr is on-target (teal).
 * Pure SVG, theme-aware via Tailwind tokens. Status color always ships with the
 * "younger/older" label beneath, never color-alone.
 */

export interface BioAgeGaugeProps {
  biologicalAge: number
  chronologicalAge: number
  delta: number // biologicalAge - chronologicalAge
  confidence?: number
}

const SPAN = 12 // ± years shown around chronological age

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = ((startDeg - 180) * Math.PI) / 180
  const e = ((endDeg - 180) * Math.PI) / 180
  const x1 = cx + r * Math.cos(s)
  const y1 = cy + r * Math.sin(s)
  const x2 = cx + r * Math.cos(e)
  const y2 = cy + r * Math.sin(e)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

export function BioAgeGauge({ biologicalAge, chronologicalAge, delta, confidence }: BioAgeGaugeProps) {
  const w = 300
  const h = 180
  const cx = w / 2
  const cy = h - 18
  const r = 120

  const lo = chronologicalAge - SPAN
  const hi = chronologicalAge + SPAN
  const clampFrac = (v: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)))
  const valueDeg = clampFrac(biologicalAge) * 180
  const chronoDeg = clampFrac(chronologicalAge) * 180 // = 90 (center)

  const younger = delta < -0.5
  const older = delta > 0.5
  const valueClass = younger
    ? 'stroke-green-600 dark:stroke-green-400'
    : older
      ? 'stroke-red-600 dark:stroke-red-400'
      : 'stroke-teal-600 dark:stroke-teal-400'

  const marker = (() => {
    const a = ((valueDeg - 180) * Math.PI) / 180
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })()

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img"
        aria-label={`Biological age ${biologicalAge.toFixed(1)}, chronological ${chronologicalAge.toFixed(0)}`}>
        {/* track */}
        <path d={arcPath(cx, cy, r, 0, 180)} className="fill-none stroke-muted" strokeWidth={14} strokeLinecap="round" />
        {/* value arc */}
        <path
          d={arcPath(cx, cy, r, 0, Math.max(0.5, valueDeg))}
          className={`fill-none ${valueClass}`}
          strokeWidth={14}
          strokeLinecap="round"
        />
        {/* chronological tick (center reference) */}
        <line
          x1={cx + (r - 12) * Math.cos((chronoDeg - 180) * Math.PI / 180)}
          y1={cy + (r - 12) * Math.sin((chronoDeg - 180) * Math.PI / 180)}
          x2={cx + (r + 12) * Math.cos((chronoDeg - 180) * Math.PI / 180)}
          y2={cy + (r + 12) * Math.sin((chronoDeg - 180) * Math.PI / 180)}
          className="stroke-muted-foreground"
          strokeWidth={2}
        />
        {/* marker */}
        <circle cx={marker.x} cy={marker.y} r={7} className="fill-background stroke-foreground" strokeWidth={2.5} />

        {/* center readout */}
        <text x={cx} y={cy - 44} textAnchor="middle" className="fill-foreground text-[44px] font-bold tabular-nums">
          {biologicalAge.toFixed(1)}
        </text>
        <text x={cx} y={cy - 22} textAnchor="middle" className="fill-muted-foreground text-[11px] font-medium uppercase tracking-wider">
          biological age
        </text>

        {/* scale ends */}
        <text x={cx - r} y={cy + 16} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">{lo.toFixed(0)}</text>
        <text x={cx + r} y={cy + 16} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">{hi.toFixed(0)}</text>
      </svg>

      <div className="mt-1 flex items-center justify-center gap-3 text-sm">
        <span className="text-muted-foreground">Chronological {chronologicalAge.toFixed(0)}</span>
        <span className="text-border">·</span>
        <span
          className={
            younger
              ? 'font-semibold text-green-600 dark:text-green-400'
              : older
                ? 'font-semibold text-red-600 dark:text-red-400'
                : 'font-semibold text-teal-600 dark:text-teal-400'
          }
        >
          {younger ? `${Math.abs(delta).toFixed(1)} yrs younger` : older ? `${delta.toFixed(1)} yrs older` : 'On target'}
        </span>
      </div>
      {confidence != null && (
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {Math.round(confidence * 100)}% confidence
        </p>
      )}
    </div>
  )
}
