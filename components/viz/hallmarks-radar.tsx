'use client'

/**
 * Hallmarks of Aging radar.
 *
 * Nine López-Otín hallmark "damage" scores (0 = optimal, 1 = severe) plotted on
 * a radial spider chart. A green reference ring marks the optimal threshold
 * (≤ 0.30); the filled teal polygon is the user's current profile. Theme-aware
 * via Tailwind tokens; per-axis hover tooltip. Pure SVG — no chart lib, CSP-safe.
 */

import { useId, useState } from 'react'

export interface HallmarkDatum {
  key: string
  label: string
  /** damage score in [0,1]; lower is better */
  score: number
}

const OPTIMAL_THRESHOLD = 0.3

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

export function HallmarksRadar({ data }: { data: HallmarkDatum[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId()

  const size = 320
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 46 // leave room for labels
  const n = data.length
  const step = 360 / n

  const ringLevels = [0.25, 0.5, 0.75, 1]

  const points = data.map((d, i) => {
    const p = polar(cx, cy, R * Math.min(1, Math.max(0, d.score)), i * step)
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  })

  const optimalRing = data
    .map((_, i) => {
      const p = polar(cx, cy, R * OPTIMAL_THRESHOLD, i * step)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto" role="img" aria-label="Hallmarks of aging radar">
        {/* grid rings */}
        {ringLevels.map((lvl) => (
          <circle
            key={lvl}
            cx={cx}
            cy={cy}
            r={R * lvl}
            className="fill-none stroke-border"
            strokeWidth={1}
          />
        ))}
        {/* spokes */}
        {data.map((d, i) => {
          const p = polar(cx, cy, R, i * step)
          return (
            <line key={d.key} x1={cx} y1={cy} x2={p.x} y2={p.y} className="stroke-border" strokeWidth={1} />
          )
        })}

        {/* optimal reference ring (≤0.30) */}
        <polygon
          points={optimalRing}
          className="fill-green-500/10 stroke-green-600/60 dark:stroke-green-400/60"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />

        {/* user profile polygon */}
        <polygon
          points={points.join(' ')}
          className="fill-teal-500/20 stroke-teal-600 dark:stroke-teal-400"
          strokeWidth={2}
        />

        {/* vertices */}
        {data.map((d, i) => {
          const p = polar(cx, cy, R * Math.min(1, Math.max(0, d.score)), i * step)
          const active = hover === i
          return (
            <circle
              key={`v-${d.key}`}
              cx={p.x}
              cy={p.y}
              r={active ? 5 : 3.5}
              className="fill-teal-600 dark:fill-teal-400 stroke-background"
              strokeWidth={2}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          )
        })}

        {/* axis labels */}
        {data.map((d, i) => {
          const p = polar(cx, cy, R + 20, i * step)
          const anchor = Math.abs(p.x - cx) < 6 ? 'middle' : p.x > cx ? 'start' : 'end'
          const short = d.label.split(' ').map((w) => w[0]).join('')
          return (
            <text
              key={`l-${d.key}`}
              x={p.x}
              y={p.y}
              dy="0.32em"
              textAnchor={anchor}
              className="fill-muted-foreground text-[9px] font-medium"
            >
              <title>{d.label}</title>
              {short}
            </text>
          )
        })}
        <text x={cx} y={cy - R - 32} textAnchor="middle" className="fill-transparent">{gid}</text>
      </svg>

      {hover !== null && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-1.5 text-xs shadow-md">
          <span className="font-medium text-foreground">{data[hover].label}</span>
          <span className="ml-2 tabular-nums text-muted-foreground">
            {Math.round(data[hover].score * 100)}% damage
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-teal-600 dark:bg-teal-400" /> Your profile
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm border border-dashed border-green-600/60 dark:border-green-400/60" /> Optimal (≤30%)
        </span>
      </div>
    </div>
  )
}
