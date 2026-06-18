/**
 * Causal-Edge Materializer — Flywheel → Knowledge Graph projection (pure core)
 *
 * Maps a de-identified, k-anonymised population effect (the shape produced by
 * `runOutcomeAggregation` → AggregateOutcome) into a `KgEdge` create-input so
 * the flywheel's accumulated outcomes become queryable in the knowledge graph.
 *
 * HONESTY CONTRACT (hard constraint):
 *   - These edges are OBSERVATIONAL ASSOCIATIONS, never mechanisms. They use the
 *     dedicated `POPULATION_ASSOCIATION` edge type, never INHIBITS/ACTIVATES etc.
 *   - Evidence grade is CAPPED at C_LOW. Observational RWE never earns A_HIGH or
 *     B_MODERATE — those are reserved for mechanistic / clinical evidence.
 *   - Edges below the publish floor are SUPPRESSED (returns null), not weakened.
 *
 * This module is pure — no DB, no I/O — so the mapping and grading rules are
 * unit-testable in isolation. The DB-writing wrapper (node resolution + upsert)
 * is a separate, reviewable step.
 *
 * @module lib/flywheel/causal-edge-materializer
 */

import { KgEdgeType, KgEvidenceGrade } from "@prisma/client"

import { canonicalNodeIdentity } from "@/lib/knowledge-graph/node-identity"

/** Source tag stamped on every materialised RWE edge. */
export const RWE_SOURCE = "biozephyra-rwe"

/** Prefix the aggregator stamps on compound-branch cohort buckets. */
export const BIOMARKER_BUCKET_PREFIX = "biomarker:"

/** Minimum sample size to publish an edge at all. Below this → suppressed. */
export const RWE_MIN_SAMPLE_SIZE = 20

/** Sample size required (with significance) to reach the C_LOW ceiling. */
export const RWE_CLOW_SAMPLE_SIZE = 50

/** p-value required (with sufficient n) to reach the C_LOW ceiling. */
export const RWE_CLOW_PVALUE = 0.05

/**
 * A de-identified population effect linking an intervention (subject) to an
 * outcome biomarker (object). All identifiers are graph node identities — never
 * user-level data.
 */
export interface PopulationEffect {
  /** Intervention node (the "from" of the edge) — e.g. a compound or protocol. */
  subjectKind: string
  subjectExternalId: string
  subjectLabel: string
  /** Outcome node (the "to" of the edge) — e.g. a biomarker. */
  objectKind: string
  objectExternalId: string
  objectLabel: string
  /** Number of de-identified subjects behind the aggregate (post k-anonymity). */
  sampleSize: number
  /** Mean outcome delta (already DP-noised upstream). */
  effectSize: number
  effectSizeUnit?: string | null
  stdDev?: number | null
  pValue?: number | null
  /** Aggregate confidence in [0,1]; clamped on output. */
  confidence?: number | null
  /** Period label of the aggregation run, e.g. "2026-Q2". */
  period: string
}

/** A graph-backend-agnostic description of the edge to upsert. */
export interface RweEdgeInput {
  fromKind: string
  fromExternalId: string
  fromLabel: string
  toKind: string
  toExternalId: string
  toLabel: string
  edgeType: KgEdgeType
  evidenceGrade: KgEvidenceGrade
  source: string
  effectSize: number
  effectSizeUnit: string | null
  confidence: number | null
  pubmedIds: null
  attributes: {
    claimType: "population_association"
    sampleSize: number
    pValue: number | null
    stdDev: number | null
    period: string
    /** Machine-readable honesty marker carried with every edge. */
    note: string
  }
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0
  return Math.min(1, Math.max(0, x))
}

/**
 * Derive the evidence grade for a population RWE association.
 *
 * Capped at C_LOW by design — observational data never reaches A/B grades.
 * Reaches C_LOW only with both adequate sample size AND a significant p-value;
 * everything else publishable is D_VERY_LOW.
 */
export function deriveRweEvidenceGrade(
  sampleSize: number,
  pValue: number | null | undefined,
): KgEvidenceGrade {
  const significant = typeof pValue === "number" && pValue <= RWE_CLOW_PVALUE
  if (sampleSize >= RWE_CLOW_SAMPLE_SIZE && significant) {
    return KgEvidenceGrade.C_LOW
  }
  return KgEvidenceGrade.D_VERY_LOW
}

/**
 * Map a population effect to a knowledge-graph edge input.
 *
 * Returns null when the effect is below the publish floor (`RWE_MIN_SAMPLE_SIZE`)
 * — such effects are suppressed entirely, never published at a weaker grade.
 */
export function deriveRweEdge(effect: PopulationEffect): RweEdgeInput | null {
  if (!Number.isFinite(effect.sampleSize) || effect.sampleSize < RWE_MIN_SAMPLE_SIZE) {
    return null
  }

  const pValue = typeof effect.pValue === "number" ? effect.pValue : null

  return {
    fromKind: effect.subjectKind,
    fromExternalId: effect.subjectExternalId,
    fromLabel: effect.subjectLabel,
    toKind: effect.objectKind,
    toExternalId: effect.objectExternalId,
    toLabel: effect.objectLabel,
    edgeType: KgEdgeType.POPULATION_ASSOCIATION,
    evidenceGrade: deriveRweEvidenceGrade(effect.sampleSize, pValue),
    source: RWE_SOURCE,
    effectSize: effect.effectSize,
    effectSizeUnit: effect.effectSizeUnit ?? null,
    confidence: typeof effect.confidence === "number" ? clamp01(effect.confidence) : null,
    pubmedIds: null,
    attributes: {
      claimType: "population_association",
      sampleSize: effect.sampleSize,
      pValue,
      stdDev: typeof effect.stdDev === "number" ? effect.stdDev : null,
      period: effect.period,
      note: "Observational population association from the Biozephyra outcomes flywheel. Not a validated mechanistic or clinical claim.",
    },
  }
}

// ─── Planning layer (pure) ────────────────────────────────────────────────────
// Maps AggregateOutcome compound-branch rows → RweEdgeInput plans, resolving
// canonical node identities. Pure so the DB wrapper stays a thin executor.

/** Minimal shape of an AggregateOutcome row the planner consumes. */
export interface AggregateOutcomeRow {
  compoundId: string | null
  cohortBucket: string
  sampleSize: number
  meanOutcomeScore: number
  stdDev: number | null
  pValue: number | null
  confidence: number | null
  period: string
}

/** Minimal compound identity used to resolve a stable graph node identity. */
export interface CompoundIdentity {
  name: string
  casNumber: string | null
  pubChemCid: string | null
}

export interface RweMaterializationPlan {
  edges: RweEdgeInput[]
  /** Compound-branch rows examined. */
  scanned: number
  /** Rows dropped because they fell below the publish floor. */
  suppressed: number
  /** Rows dropped because no compound identity could be resolved. */
  skippedNoCompound: number
}

/** Extract the biomarker label from an aggregator cohort bucket, or null. */
export function biomarkerFromBucket(cohortBucket: string): string | null {
  if (!cohortBucket.startsWith(BIOMARKER_BUCKET_PREFIX)) return null
  const name = cohortBucket.slice(BIOMARKER_BUCKET_PREFIX.length).trim()
  return name === "" ? null : name
}

/**
 * Plan the RWE edges to materialise from a set of aggregate rows.
 *
 * Only compound-branch rows (cohortBucket = "biomarker:<name>") with a
 * resolvable compound are considered; everything else is skipped or suppressed
 * and reported in the counters. No DB access — the caller executes the plan.
 */
export function planRweMaterialization(input: {
  tenantId: string
  aggregates: AggregateOutcomeRow[]
  compoundsById: Map<string, CompoundIdentity>
}): RweMaterializationPlan {
  const edges: RweEdgeInput[] = []
  let scanned = 0
  let suppressed = 0
  let skippedNoCompound = 0

  for (const row of input.aggregates) {
    const biomarker = biomarkerFromBucket(row.cohortBucket)
    if (biomarker === null) continue // not a compound-branch row
    scanned++

    const compound = row.compoundId ? input.compoundsById.get(row.compoundId) : undefined
    if (!compound) {
      skippedNoCompound++
      continue
    }

    const subjectExternalId = canonicalNodeIdentity({
      tenantId: input.tenantId,
      kind: "compound",
      canonicalName: compound.name,
      externalIds: { cas: compound.casNumber, pubchem: compound.pubChemCid },
    })
    const objectExternalId = canonicalNodeIdentity({
      tenantId: input.tenantId,
      kind: "biomarker",
      canonicalName: biomarker,
    })

    const edge = deriveRweEdge({
      subjectKind: "compound",
      subjectExternalId,
      subjectLabel: compound.name,
      objectKind: "biomarker",
      objectExternalId,
      objectLabel: biomarker,
      sampleSize: row.sampleSize,
      effectSize: row.meanOutcomeScore,
      effectSizeUnit: null,
      stdDev: row.stdDev,
      pValue: row.pValue,
      confidence: row.confidence,
      period: row.period,
    })

    if (!edge) {
      suppressed++
      continue
    }
    edges.push(edge)
  }

  return { edges, scanned, suppressed, skippedNoCompound }
}
