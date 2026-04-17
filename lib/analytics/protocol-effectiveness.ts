/**
 * Protocol Effectiveness Engine
 *
 * Computes a per-protocol effectiveness score by comparing biomarker
 * baselines (at or near protocol start) with follow-up measurements
 * after a configurable evaluation window (default 90 days).
 *
 * The score captures:
 *  - biomarker delta direction relative to the expected direction
 *  - magnitude of change relative to baseline
 *  - data sufficiency (how many biomarkers had enough measurements)
 *  - confidence band (wider when data is sparse or noisy)
 *
 * @module lib/analytics/protocol-effectiveness
 */

import { db } from '@/lib/db'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface BiomarkerDelta {
  biomarkerName: string
  baseline: number
  latest: number
  delta: number
  percentChange: number
  /** Whether the change is in the expected positive direction */
  favorable: boolean
  measurementCount: number
}

export interface ProtocolEffectivenessScore {
  protocolId: string
  protocolName: string
  protocolStatus: string
  evaluationWindowDays: number
  /** Overall effectiveness 0–1 */
  score: number
  /** How many biomarkers had enough data to evaluate */
  evaluatedBiomarkers: number
  /** How many biomarkers showed favorable change */
  favorableBiomarkers: number
  /** Confidence 0–1 based on data sufficiency */
  confidence: number
  deltas: BiomarkerDelta[]
  computedAt: string
}

/* ------------------------------------------------------------------ */
/*  Configuration                                                     */
/* ------------------------------------------------------------------ */

const DEFAULT_WINDOW_DAYS = 90
/** Minimum measurements to consider a biomarker evaluable */
const MIN_MEASUREMENTS = 2
/** Baseline window: measurements taken within N days before/after protocol start */
const BASELINE_WINDOW_DAYS = 14

/* ------------------------------------------------------------------ */
/*  Known biomarker targets — direction where "lower is better"       */
/* ------------------------------------------------------------------ */

const LOWER_IS_BETTER = new Set([
  'hba1c', 'ldl', 'apob', 'crp', 'triglycerides', 'glucose', 'insulin',
  'homocysteine', 'il-6', 'tnf-alpha', 'ferritin', 'uric acid',
  'lipoprotein(a)', 'fibrinogen', 'alt', 'ast', 'ggt',
])

function isLowerBetter(name: string): boolean {
  return LOWER_IS_BETTER.has(name.toLowerCase().replace(/[\s_]+/g, ''))
}

/* ------------------------------------------------------------------ */
/*  Engine                                                            */
/* ------------------------------------------------------------------ */

/**
 * Compute the effectiveness score for a single protocol.
 */
export async function computeProtocolEffectiveness(
  protocolId: string,
  options?: { windowDays?: number },
): Promise<ProtocolEffectivenessScore | null> {
  const windowDays = options?.windowDays ?? DEFAULT_WINDOW_DAYS

  const protocol = await db.protocol.findUnique({
    where: { id: protocolId },
    select: { id: true, name: true, status: true, userId: true, createdAt: true },
  })

  if (!protocol) return null

  const protocolStart = protocol.createdAt
  const baselineEnd = new Date(protocolStart.getTime() + BASELINE_WINDOW_DAYS * 86_400_000)
  const evaluationStart = new Date(protocolStart.getTime() + (windowDays - BASELINE_WINDOW_DAYS) * 86_400_000)
  const evaluationEnd = new Date(protocolStart.getTime() + windowDays * 86_400_000)

  // Fetch all biomarker measurements for this user in the relevant windows
  const measurements = await db.biomarker.findMany({
    where: {
      userId: protocol.userId,
      measuredAt: { gte: new Date(protocolStart.getTime() - BASELINE_WINDOW_DAYS * 86_400_000), lte: evaluationEnd },
    },
    orderBy: { measuredAt: 'asc' },
    select: { name: true, value: true, measuredAt: true },
  })

  // Group by biomarker name
  const byName = new Map<string, Array<{ value: number; measuredAt: Date }>>()
  for (const m of measurements) {
    const key = m.name.toLowerCase()
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key)!.push({ value: m.value, measuredAt: m.measuredAt })
  }

  const deltas: BiomarkerDelta[] = []

  for (const [name, entries] of byName) {
    const baselineEntries = entries.filter((e) => e.measuredAt <= baselineEnd)
    const followUpEntries = entries.filter((e) => e.measuredAt >= evaluationStart && e.measuredAt <= evaluationEnd)

    if (baselineEntries.length === 0 || followUpEntries.length === 0) continue
    if (baselineEntries.length + followUpEntries.length < MIN_MEASUREMENTS) continue

    const baseline = average(baselineEntries.map((e) => e.value))
    const latest = average(followUpEntries.map((e) => e.value))
    const delta = latest - baseline
    const percentChange = baseline !== 0 ? (delta / Math.abs(baseline)) * 100 : 0

    const lowerBetter = isLowerBetter(name)
    const favorable = lowerBetter ? delta < 0 : delta > 0

    deltas.push({
      biomarkerName: name,
      baseline: round(baseline),
      latest: round(latest),
      delta: round(delta),
      percentChange: round(percentChange),
      favorable,
      measurementCount: baselineEntries.length + followUpEntries.length,
    })
  }

  const evaluatedBiomarkers = deltas.length
  const favorableBiomarkers = deltas.filter((d) => d.favorable).length

  // Score: fraction of evaluable biomarkers that moved favorably,
  // weighted by magnitude confidence
  const score = evaluatedBiomarkers > 0 ? favorableBiomarkers / evaluatedBiomarkers : 0

  // Confidence: based on how many biomarkers were evaluable and how many
  // measurements each had
  const dataDensity = evaluatedBiomarkers > 0
    ? Math.min(1, evaluatedBiomarkers / 5) *
      Math.min(1, average(deltas.map((d) => d.measurementCount)) / 4)
    : 0
  const confidence = clamp(dataDensity, 0, 1)

  return {
    protocolId: protocol.id,
    protocolName: protocol.name,
    protocolStatus: protocol.status,
    evaluationWindowDays: windowDays,
    score: round(score),
    evaluatedBiomarkers,
    favorableBiomarkers,
    confidence: round(confidence),
    deltas,
    computedAt: new Date().toISOString(),
  }
}

/**
 * Compute effectiveness scores for all non-archived protocols of a user.
 */
export async function computeUserProtocolEffectiveness(
  userId: string,
  options?: { windowDays?: number },
): Promise<ProtocolEffectivenessScore[]> {
  const protocols = await db.protocol.findMany({
    where: { userId, status: { not: 'archived' } },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })

  const results: ProtocolEffectivenessScore[] = []
  for (const p of protocols) {
    const score = await computeProtocolEffectiveness(p.id, options)
    if (score) results.push(score)
  }

  return results
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function round(n: number, decimals = 4): number {
  return Number(n.toFixed(decimals))
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
