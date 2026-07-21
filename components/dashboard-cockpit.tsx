'use client'

/**
 * Health cockpit — the top of the dashboard.
 *
 * Leads with the single hero metric (biological age) + the hallmarks radar,
 * then answers the two questions a returning user actually has: "what changed?"
 * and "what should I do next?". Everything below this on the page is detail.
 */

import Link from 'next/link'
import { ArrowRight, ArrowDown, ArrowUp, Minus, Sparkles, FlaskConical, Activity, ShieldAlert } from 'lucide-react'

import { BioAgeGauge } from '@/components/viz/bio-age-gauge'
import { HallmarksRadar, type HallmarkDatum } from '@/components/viz/hallmarks-radar'
import { BiomarkerTrend, type TrendPoint } from '@/components/viz/biomarker-trend'
import { getReferenceRange, biomarkerStatus } from '@/lib/biomarkers/reference-ranges'

export interface CockpitBioAge {
  biologicalAge: number
  chronologicalAge: number
  delta: number
  confidence: number
  hallmarkScores: Record<string, number>
}

export interface CockpitMarkerSeries {
  name: string
  unit: string
  points: TrendPoint[] // ascending or any order
}

export interface DoNextAction {
  label: string
  href: string
  urgent?: boolean
}

const HALLMARK_LABELS: Record<string, string> = {
  genomicInstability: 'Genomic Instability',
  telomereDysfunction: 'Telomere Dysfunction',
  epigeneticAlteration: 'Epigenetic Alteration',
  lossOfProteostasis: 'Loss of Proteostasis',
  disabledMacroautophagy: 'Disabled Macroautophagy',
  mitochondrialDysfunction: 'Mitochondrial Dysfunction',
  cellularSenescence: 'Cellular Senescence',
  stemCellExhaustion: 'Stem Cell Exhaustion',
  alteredIntercellularCommunication: 'Altered Intercellular Communication',
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border bg-card p-6 ${className}`}>{children}</section>
}

export function DashboardCockpit({
  bioAge,
  markerSeries,
  doNext,
}: {
  bioAge: CockpitBioAge | null
  markerSeries: CockpitMarkerSeries[]
  doNext: DoNextAction[]
}) {
  const radarData: HallmarkDatum[] = bioAge
    ? Object.keys(HALLMARK_LABELS).map((key) => ({
        key,
        label: HALLMARK_LABELS[key],
        score: bioAge.hallmarkScores[key] ?? 0,
      }))
    : []

  // "What changed": latest vs previous per marker, most-recently-measured first.
  const changes = markerSeries
    .map((m) => {
      const pts = [...m.points].sort((a, b) => +new Date(a.date) - +new Date(b.date))
      const latest = pts[pts.length - 1]
      const prev = pts.length > 1 ? pts[pts.length - 2] : null
      const status = latest ? biomarkerStatus(m.name, latest.value) : null
      const dir = prev ? Math.sign(latest.value - prev.value) : 0
      return { name: m.name, unit: m.unit, latest, prev, status, dir, count: pts.length }
    })
    .filter((c) => c.latest)

  // Featured trend: the marker with the most history that has a known range.
  const featured = markerSeries
    .filter((m) => m.points.length >= 2 && getReferenceRange(m.name))
    .sort((a, b) => b.points.length - a.points.length)[0]
  const featuredRange = featured ? getReferenceRange(featured.name) : null

  return (
    <div className="space-y-6">
      {/* Hero row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Bio-age */}
        <Card className="lg:col-span-1 flex flex-col justify-center">
          {bioAge ? (
            <BioAgeGauge
              biologicalAge={bioAge.biologicalAge}
              chronologicalAge={bioAge.chronologicalAge}
              delta={bioAge.delta}
              confidence={bioAge.confidence}
            />
          ) : (
            <div className="text-center">
              <Activity className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-3 text-lg font-semibold">Biological age</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Compute a bio-age from your biomarkers to unlock your hero score and hallmark profile.
              </p>
              <Link
                href="/bio-age"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Compute bio-age <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </Card>

        {/* Hallmarks radar */}
        <Card className="lg:col-span-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-sm font-semibold">Hallmarks of aging</h3>
          </div>
          {bioAge ? (
            <HallmarksRadar data={radarData} />
          ) : (
            <div className="flex h-[280px] items-center justify-center text-center text-sm text-muted-foreground">
              Your 9-hallmark damage profile appears here once bio-age is computed.
            </div>
          )}
        </Card>

        {/* Do next */}
        <Card className="lg:col-span-1">
          <h3 className="text-sm font-semibold">Do next</h3>
          <ul className="mt-3 space-y-2">
            {doNext.length === 0 && (
              <li className="text-sm text-muted-foreground">You&apos;re all caught up.</li>
            )}
            {doNext.map((a) => (
              <li key={a.href + a.label}>
                <Link
                  href={a.href}
                  className={`flex items-center justify-between gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-accent ${
                    a.urgent ? 'border-red-500/40 bg-red-500/5' : ''
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {a.urgent ? (
                      <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-primary" />
                    )}
                    <span className={a.urgent ? 'font-medium text-red-700 dark:text-red-300' : ''}>{a.label}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* What changed + featured trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">What changed</h3>
          </div>
          {changes.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">No biomarker readings yet.</p>
              <Link href="/dashboard#add" className="text-sm font-medium text-primary hover:underline">
                Add your first panel →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {changes.slice(0, 6).map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {c.latest!.value} {c.unit}
                      {c.prev && (
                        <span className="ml-1">
                          {c.dir > 0 ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : c.dir < 0 ? (
                            <ArrowDown className="inline h-3 w-3" />
                          ) : (
                            <Minus className="inline h-3 w-3" />
                          )}
                        </span>
                      )}
                    </p>
                  </div>
                  {c.status && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === 'good'
                          ? 'bg-green-500/15 text-green-700 dark:text-green-300'
                          : 'bg-red-500/15 text-red-700 dark:text-red-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          c.status === 'good' ? 'bg-green-600 dark:bg-green-400' : 'bg-red-600 dark:bg-red-400'
                        }`}
                      />
                      {c.status === 'good' ? 'In range' : 'Out of range'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Trend spotlight</h3>
          </div>
          {featured && featuredRange ? (
            <BiomarkerTrend
              name={featured.name}
              unit={featured.unit}
              points={featured.points}
              range={{ low: featuredRange.low, high: featuredRange.high }}
            />
          ) : (
            <div className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
              Track a biomarker across two or more dates to see its trend against the optimal range.
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
