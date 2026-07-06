'use client'

/**
 * Biomarker trend with an optimal band.
 *
 * A single-series line over time with the reference range drawn as a green
 * "optimal" band (range.low → range.high). Points inside the band read good;
 * points outside are flagged (amber/red) with a status dot — never color-alone,
 * the tooltip states the status in words. Crosshair + tooltip on hover.
 * Pure SVG, theme-aware. One measure → one axis (no dual-axis).
 */

import { useRef, useState } from 'react'

export interface TrendPoint {
  date: string // ISO
  value: number
}

export interface BiomarkerTrendProps {
  name: string
  unit: string
  points: TrendPoint[]
  range: { low: number; high: number }
  height?: number
}

export function BiomarkerTrend({ name, unit, points, range, height = 200 }: BiomarkerTrendProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const w = 560
  const h = height
  const padL = 44
  const padR = 16
  const padT = 16
  const padB = 28
  const innerW = w - padL - padR
  const innerH = h - padT - padB

  const sorted = [...points].sort((a, b) => +new Date(a.date) - +new Date(b.date))
  const values = sorted.map((p) => p.value)
  const dataMin = Math.min(...values, range.low)
  const dataMax = Math.max(...values, range.high)
  const pad = (dataMax - dataMin) * 0.12 || 1
  const yMin = dataMin - pad
  const yMax = dataMax + pad

  const x = (i: number) => padL + (sorted.length <= 1 ? innerW / 2 : (i / (sorted.length - 1)) * innerW)
  const y = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH

  const inRange = (v: number) => v >= range.low && v <= range.high
  const linePath = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')

  const bandTop = y(range.high)
  const bandBottom = y(range.low)

  const handleMove = (e: React.MouseEvent) => {
    const svg = svgRef.current
    if (!svg || sorted.length === 0) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * w
    let best = 0
    let bestD = Infinity
    sorted.forEach((_, i) => {
      const d = Math.abs(x(i) - px)
      if (d < bestD) { bestD = d; best = i }
    })
    setHoverIdx(best)
  }

  const yTicks = [range.low, range.high]

  return (
    <div className="w-full">
      <div className="mb-1 flex items-baseline justify-between">
        <h4 className="text-sm font-medium text-foreground">{name}</h4>
        <span className="text-xs text-muted-foreground">
          optimal {range.low}–{range.high} {unit}
        </span>
      </div>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${h}`}
          className="w-full h-auto"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
          role="img"
          aria-label={`${name} trend`}
        >
          {/* optimal band */}
          <rect
            x={padL}
            y={bandTop}
            width={innerW}
            height={Math.max(0, bandBottom - bandTop)}
            className="fill-green-500/12"
          />
          <line x1={padL} y1={bandTop} x2={w - padR} y2={bandTop} className="stroke-green-600/40 dark:stroke-green-400/40" strokeWidth={1} strokeDasharray="4 3" />
          <line x1={padL} y1={bandBottom} x2={w - padR} y2={bandBottom} className="stroke-green-600/40 dark:stroke-green-400/40" strokeWidth={1} strokeDasharray="4 3" />

          {/* y tick labels for range bounds */}
          {yTicks.map((t) => (
            <text key={t} x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
              {t}
            </text>
          ))}

          {/* trend line */}
          {sorted.length > 1 && (
            <path d={linePath} className="fill-none stroke-teal-600 dark:stroke-teal-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* crosshair */}
          {hoverIdx !== null && (
            <line x1={x(hoverIdx)} y1={padT} x2={x(hoverIdx)} y2={padT + innerH} className="stroke-border" strokeWidth={1} />
          )}

          {/* points */}
          {sorted.map((p, i) => {
            const ok = inRange(p.value)
            const cls = ok
              ? 'fill-green-600 dark:fill-green-400'
              : 'fill-red-600 dark:fill-red-400'
            return (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={hoverIdx === i ? 5 : 3.5}
                className={`${cls} stroke-background`}
                strokeWidth={2}
              />
            )
          })}

          {/* x end dates */}
          {sorted.length > 0 && (
            <>
              <text x={padL} y={h - 8} textAnchor="start" className="fill-muted-foreground text-[10px]">
                {new Date(sorted[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
              <text x={w - padR} y={h - 8} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {new Date(sorted[sorted.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            </>
          )}
        </svg>

        {hoverIdx !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: `${(x(hoverIdx) / w) * 100}%`, transform: 'translateX(-50%)' }}
          >
            <div className="tabular-nums font-medium text-foreground">
              {sorted[hoverIdx].value} {unit}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {new Date(sorted[hoverIdx].date).toLocaleDateString()}
            </div>
            <div className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium ${inRange(sorted[hoverIdx].value) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${inRange(sorted[hoverIdx].value) ? 'bg-green-600 dark:bg-green-400' : 'bg-red-600 dark:bg-red-400'}`} />
              {inRange(sorted[hoverIdx].value) ? 'In optimal range' : 'Out of range'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
