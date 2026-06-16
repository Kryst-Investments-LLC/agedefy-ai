// All functions are pure — they take pre-fetched rows and return metric structs.
// No DB calls, no LLM calls, no hardcoded estimates.

export const QED_HIT_THRESHOLD = 0.4 // documented drug-likeness cutoff (Bickerton 2012)
export const FEEDBACK_HIT_THRESHOLD = 0.5 // feedbackScore >= 0.5 → "hit"
export const CYCLE_TIME_MIN_N = 3 // minimum cohort size for percentile reporting

// ─── Input row types (Prisma select shapes) ───────────────────────────────────

export interface CandidateRow {
  id: string
  createdAt: Date
  status: string
  acquisitionScore: number | null
  feedbackScore: number | null
  screenJson: Record<string, unknown> | null
  labResults: LabResultRow[]
  events: EventRow[]
}

export interface LabResultRow {
  flag: string | null
}

export interface EventRow {
  fromStatus: string | null
  toStatus: string
  createdAt: Date
}

export interface TransactionRow {
  amountCents: number
  status: string
}

export interface LinkedTransactionRow {
  candidateId: string | null
  amountCents: number
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface HitRateUplift {
  alHitRate: number
  baselineHitRate: number
  uplift: number
  alN: number
  baselineN: number
}

export interface CostMetrics {
  totalSpendCents: number
  validatedHits: number
  costPerHitCents: number | null
}

export interface CycleTimeMetrics {
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

export interface ClassificationMetrics {
  screenPositives: number
  screenNegatives: number
  falsePositiveRate: number | null
  falseNegativeRate: number | null
}

export interface PilotMetrics {
  hitRateUplift: HitRateUplift
  cost: CostMetrics
  cycleTime: CycleTimeMetrics
  classification: ClassificationMetrics
  insufficientData: boolean
  computedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isHit(candidate: CandidateRow): boolean {
  return candidate.labResults.some((r) => r.flag === "active")
}

function qed(candidate: CandidateRow): number | null {
  const val = candidate.screenJson?.["qed"]
  return typeof val === "number" ? val : null
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.max(0, Math.ceil(sorted.length * p) - 1)
  return sorted[idx]
}

function median(sorted: number[]): number | null {
  return percentile(sorted, 0.5)
}

function firstEventTo(events: EventRow[], toStatus: string): EventRow | null {
  return events.find((e) => e.toStatus === toStatus) ?? null
}

function stageDurationSec(events: EventRow[], from: string, to: string, candidateCreatedAt: Date): number | null {
  const toEvent = firstEventTo(events, to)
  if (!toEvent) return null

  if (from === "PROPOSED") {
    // PROPOSED is the start — use candidateCreatedAt as the origin
    return (toEvent.createdAt.getTime() - candidateCreatedAt.getTime()) / 1000
  }
  const fromEvent = firstEventTo(events, from)
  if (!fromEvent) return null
  const diff = (toEvent.createdAt.getTime() - fromEvent.createdAt.getTime()) / 1000
  return diff >= 0 ? diff : null
}

// ─── Public computation functions ─────────────────────────────────────────────

export function computeHitRateUplift(fedBackCandidates: CandidateRow[]): HitRateUplift {
  const alCohort = fedBackCandidates.filter((c) => c.acquisitionScore !== null)
  const baselineCohort = fedBackCandidates.filter((c) => c.acquisitionScore === null)

  const hitRate = (cohort: CandidateRow[]) =>
    cohort.length === 0 ? 0 : cohort.filter(isHit).length / cohort.length

  const alHitRate = hitRate(alCohort)
  const baselineHitRate = hitRate(baselineCohort)

  return {
    alHitRate,
    baselineHitRate,
    uplift: alHitRate - baselineHitRate,
    alN: alCohort.length,
    baselineN: baselineCohort.length,
  }
}

export function computeCostMetrics(
  fedBackCandidates: CandidateRow[],
  linkedTransactions: LinkedTransactionRow[],
): CostMetrics {
  const validatedHitIds = new Set(
    fedBackCandidates.filter(isHit).map((c) => c.id),
  )

  const totalSpendCents = linkedTransactions
    .filter((t) => t.candidateId !== null && validatedHitIds.has(t.candidateId))
    .reduce((sum, t) => sum + t.amountCents, 0)

  const validatedHits = validatedHitIds.size

  return {
    totalSpendCents,
    validatedHits,
    costPerHitCents: validatedHits > 0 ? Math.round(totalSpendCents / validatedHits) : null,
  }
}

export function computeCycleTimeMetrics(fedBackCandidates: CandidateRow[]): CycleTimeMetrics {
  const stagePairs: Array<[string, string]> = [
    ["PROPOSED", "SCREENED"],
    ["SCREENED", "SENT_TO_LAB"],
    ["SENT_TO_LAB", "RESULT_LOGGED"],
    ["RESULT_LOGGED", "FED_BACK"],
  ]

  const totalTimes: number[] = []
  const stageSamples: Record<string, number[]> = {
    proposedToScreened: [],
    screenedToSent: [],
    sentToLogged: [],
    loggedToFed: [],
  }
  const stageKeys = ["proposedToScreened", "screenedToSent", "sentToLogged", "loggedToFed"]

  for (const candidate of fedBackCandidates) {
    const fedEvent = firstEventTo(candidate.events, "FED_BACK")
    if (!fedEvent) continue
    const total = (fedEvent.createdAt.getTime() - candidate.createdAt.getTime()) / 1000
    if (total >= 0) totalTimes.push(total)

    stagePairs.forEach(([from, to], i) => {
      const dur = stageDurationSec(candidate.events, from, to, candidate.createdAt)
      if (dur !== null) stageSamples[stageKeys[i]].push(dur)
    })
  }

  const sorted = [...totalTimes].sort((a, b) => a - b)
  const n = sorted.length

  return {
    medianCycleTimeSec: n >= CYCLE_TIME_MIN_N ? median(sorted) : null,
    p75CycleTimeSec: n >= CYCLE_TIME_MIN_N ? percentile(sorted, 0.75) : null,
    stageTimes: {
      proposedToScreened: median([...stageSamples["proposedToScreened"]].sort((a, b) => a - b)),
      screenedToSent: median([...stageSamples["screenedToSent"]].sort((a, b) => a - b)),
      sentToLogged: median([...stageSamples["sentToLogged"]].sort((a, b) => a - b)),
      loggedToFed: median([...stageSamples["loggedToFed"]].sort((a, b) => a - b)),
    },
    n,
  }
}

export function computeClassificationMetrics(
  candidatesWithScreenAndLab: CandidateRow[],
): ClassificationMetrics {
  let tp = 0, fp = 0, tn = 0, fn = 0

  for (const c of candidatesWithScreenAndLab) {
    const q = qed(c)
    if (q === null) continue

    const screenPos = q >= QED_HIT_THRESHOLD
    const labPos = c.labResults.some((r) => r.flag === "active" || r.flag === "borderline")

    if (screenPos && labPos) tp++
    else if (screenPos && !labPos) fp++
    else if (!screenPos && !labPos) tn++
    else fn++
  }

  const screenPositives = tp + fp
  const screenNegatives = tn + fn
  const actualNegatives = fp + tn
  const actualPositives = tp + fn

  return {
    screenPositives,
    screenNegatives,
    falsePositiveRate: actualNegatives > 0 ? fp / actualNegatives : null,
    falseNegativeRate: actualPositives > 0 ? fn / actualPositives : null,
  }
}

export function assemblePilotMetrics(
  fedBackCandidates: CandidateRow[],
  candidatesWithScreenAndLab: CandidateRow[],
  linkedTransactions: LinkedTransactionRow[],
): PilotMetrics {
  const insufficientData = fedBackCandidates.length === 0

  return {
    hitRateUplift: computeHitRateUplift(fedBackCandidates),
    cost: computeCostMetrics(fedBackCandidates, linkedTransactions),
    cycleTime: computeCycleTimeMetrics(fedBackCandidates),
    classification: computeClassificationMetrics(candidatesWithScreenAndLab),
    insufficientData,
    computedAt: new Date().toISOString(),
  }
}
