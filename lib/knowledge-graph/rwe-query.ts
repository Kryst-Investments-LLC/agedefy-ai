/**
 * RWE Population-Edge Query — shaping + guardrails (pure)
 *
 * Shapes raw KgEdge POPULATION_ASSOCIATION rows into the response DTO for the
 * researcher-gated graph query API, and enforces the population-privacy and
 * honesty guardrails as defense-in-depth:
 *
 *   - k-anonymity floor: any edge whose backing sampleSize is below the floor
 *     is dropped here too, even though the aggregator already suppressed it.
 *   - framing: every response carries the "research information, not medical
 *     advice" + "population association, not a validated mechanism" statements.
 *
 * Pure module — no DB, no I/O.
 *
 * @module lib/knowledge-graph/rwe-query
 */

import { KgEvidenceGrade } from "@prisma/client"

import { RWE_MIN_SAMPLE_SIZE } from "@/lib/flywheel/causal-edge-materializer"

/** k-anonymity floor re-enforced at read time (matches the publish floor). */
export const RWE_QUERY_K_FLOOR = RWE_MIN_SAMPLE_SIZE

/** Mandatory framing attached to every RWE query response. */
export const RWE_QUERY_FRAMING = {
  notice:
    "Research information, not medical advice — consult a qualified clinician. " +
    "These are observational population associations, not validated mechanisms or clinical guidance.",
  population: "Aggregate, de-identified population data. k-anonymity and differential privacy applied upstream.",
  evidence: "Observational real-world evidence (RWE). Evidence grade is capped at C_LOW; never a validated claim.",
} as const

const GRADE_RANK: Record<KgEvidenceGrade, number> = {
  A_HIGH: 4,
  B_MODERATE: 3,
  C_LOW: 2,
  D_VERY_LOW: 1,
}

/** Node projection on an edge row. */
export interface RweQueryNode {
  label: string
  kind: string
  externalId: string
}

/** Raw KgEdge row shape the shaper consumes (Prisma select result). */
export interface RweEdgeRow {
  evidenceGrade: KgEvidenceGrade
  source: string
  effectSize: number | null
  effectSizeUnit: string | null
  confidence: number | null
  attributes: unknown
  fromNode: RweQueryNode
  toNode: RweQueryNode
}

/** Shaped outcome returned to the caller. */
export interface RweOutcomeDto {
  intervention: { label: string; kind: string }
  outcome: { label: string; kind: string }
  effectSize: number | null
  effectSizeUnit: string | null
  evidenceGrade: KgEvidenceGrade
  confidence: number | null
  sampleSize: number | null
  pValue: number | null
  period: string | null
  claimType: string | null
  source: string
}

export interface ShapeResult {
  outcomes: RweOutcomeDto[]
  /** Rows dropped because their backing sampleSize was below the k-anon floor. */
  suppressedBelowFloor: number
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null
}

function readAttributes(attributes: unknown): {
  sampleSize: number | null
  pValue: number | null
  period: string | null
  claimType: string | null
} {
  const a = (attributes && typeof attributes === "object" ? attributes : {}) as Record<string, unknown>
  return {
    sampleSize: asNumber(a.sampleSize),
    pValue: asNumber(a.pValue),
    period: asString(a.period),
    claimType: asString(a.claimType),
  }
}

/** True when an evidence grade meets or exceeds the requested minimum. */
export function gradeMeets(grade: KgEvidenceGrade, min: KgEvidenceGrade): boolean {
  return GRADE_RANK[grade] >= GRADE_RANK[min]
}

/**
 * Shape raw edge rows into outcome DTOs, dropping any whose backing sample size
 * is below the k-anonymity floor (defense-in-depth).
 */
export function shapeRweOutcomes(rows: RweEdgeRow[]): ShapeResult {
  const outcomes: RweOutcomeDto[] = []
  let suppressedBelowFloor = 0

  for (const row of rows) {
    const attr = readAttributes(row.attributes)

    // Re-enforce the k-anon floor: a missing or below-floor sample size is dropped.
    if (attr.sampleSize === null || attr.sampleSize < RWE_QUERY_K_FLOOR) {
      suppressedBelowFloor++
      continue
    }

    outcomes.push({
      intervention: { label: row.fromNode.label, kind: row.fromNode.kind },
      outcome: { label: row.toNode.label, kind: row.toNode.kind },
      effectSize: row.effectSize,
      effectSizeUnit: row.effectSizeUnit,
      evidenceGrade: row.evidenceGrade,
      confidence: row.confidence,
      sampleSize: attr.sampleSize,
      pValue: attr.pValue,
      period: attr.period,
      claimType: attr.claimType,
      source: row.source,
    })
  }

  return { outcomes, suppressedBelowFloor }
}
