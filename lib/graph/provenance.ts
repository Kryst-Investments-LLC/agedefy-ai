/**
 * Provenance & Review State Tracking
 *
 * Makes provenance, uncertainty, and review state visible wherever
 * high-impact claims appear. Adds a unified review-state persistence
 * layer that works across all domain entities.
 *
 * @module lib/graph/provenance
 */

import { db } from '@/lib/db'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type ProvenanceDomain =
  | 'evidence'
  | 'hypothesis'
  | 'aeonforge-candidate'
  | 'mechanistic-model'
  | 'intervention-outcome'

export interface ProvenanceSnapshot {
  domain: ProvenanceDomain
  entityId: string
  title: string
  uncertaintyScore: number
  confidenceScore: number
  reviewStatus: string
  provenanceSource: string
  provenanceType: string
  reviewedAt: string | null
  reviewedBy: string | null
  /** True when the claim should display a high-impact warning */
  highImpact: boolean
}

/* ------------------------------------------------------------------ */
/*  High-impact threshold (shows badge / warning in UI)               */
/* ------------------------------------------------------------------ */

const HIGH_IMPACT_UNCERTAINTY_THRESHOLD = 0.4

/* ------------------------------------------------------------------ */
/*  Per-domain provenance extractors                                  */
/* ------------------------------------------------------------------ */

async function evidenceProvenance(userId: string): Promise<ProvenanceSnapshot[]> {
  const records = await db.evidenceRecord.findMany({
    where: { createdByUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return records.map((r) => ({
    domain: 'evidence' as const,
    entityId: r.id,
    title: r.title,
    uncertaintyScore: r.uncertaintyScore,
    confidenceScore: r.evidenceScore,
    reviewStatus: r.reviewStatus,
    provenanceSource: r.sourceLabel,
    provenanceType: r.provenanceType,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    reviewedBy: r.reviewedByUserId ?? null,
    highImpact: r.uncertaintyScore >= HIGH_IMPACT_UNCERTAINTY_THRESHOLD,
  }))
}

async function hypothesisProvenance(userId: string): Promise<ProvenanceSnapshot[]> {
  const records = await db.hypothesis.findMany({
    where: { ownerUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return records.map((h) => ({
    domain: 'hypothesis' as const,
    entityId: h.id,
    title: h.title,
    uncertaintyScore: h.uncertaintyScore,
    confidenceScore: h.confidenceScore,
    reviewStatus: h.status,
    provenanceSource: 'hypothesis-engine',
    provenanceType: 'USER_CREATED',
    reviewedAt: null,
    reviewedBy: null,
    highImpact: h.uncertaintyScore >= HIGH_IMPACT_UNCERTAINTY_THRESHOLD,
  }))
}

async function aeonforgeProvenance(userId: string): Promise<ProvenanceSnapshot[]> {
  const records = await db.aeonForgeCandidate.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return records.map((c) => ({
    domain: 'aeonforge-candidate' as const,
    entityId: c.id,
    title: `ÆonForge Discovery — ${c.status}`,
    uncertaintyScore: 1 - (c.simulationScore ?? 0.5),
    confidenceScore: c.simulationScore ?? 0.5,
    reviewStatus: c.status,
    provenanceSource: 'aeonforge',
    provenanceType: 'AI_GENERATED',
    reviewedAt: null,
    reviewedBy: null,
    highImpact: (1 - (c.simulationScore ?? 0.5)) >= HIGH_IMPACT_UNCERTAINTY_THRESHOLD,
  }))
}

async function modelProvenance(userId: string): Promise<ProvenanceSnapshot[]> {
  const scores = await db.modelConfidenceScore.findMany({
    where: { mechanisticModel: { createdById: userId } },
    include: { mechanisticModel: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return scores.map((s) => ({
    domain: 'mechanistic-model' as const,
    entityId: s.mechanisticModelId,
    title: s.mechanisticModel.name,
    uncertaintyScore: 1 - s.score,
    confidenceScore: s.score,
    reviewStatus: s.rationale ?? 'scored',
    provenanceSource: s.version ?? 'model-scorer',
    provenanceType: 'COMPUTED',
    reviewedAt: null,
    reviewedBy: null,
    highImpact: (1 - s.score) >= HIGH_IMPACT_UNCERTAINTY_THRESHOLD,
  }))
}

async function outcomeProvenance(userId: string): Promise<ProvenanceSnapshot[]> {
  const records = await db.interventionOutcome.findMany({
    where: { userId },
    orderBy: { observedAt: 'desc' },
    take: 200,
  })
  return records.map((o) => ({
    domain: 'intervention-outcome' as const,
    entityId: o.id,
    title: `${o.biomarkerName}: ${o.baselineValue} → ${o.latestValue}`,
    uncertaintyScore: 1 - o.confidenceScore,
    confidenceScore: o.confidenceScore,
    reviewStatus: 'observed',
    provenanceSource: 'outcome-tracking',
    provenanceType: 'OBSERVED',
    reviewedAt: null,
    reviewedBy: null,
    highImpact: (1 - o.confidenceScore) >= HIGH_IMPACT_UNCERTAINTY_THRESHOLD,
  }))
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export interface GetProvenanceOptions {
  domains?: ProvenanceDomain[]
  highImpactOnly?: boolean
}

/**
 * Retrieve provenance snapshots for a user, optionally filtered by domain
 * or to high-impact items only.
 */
export async function getProvenanceSnapshots(
  userId: string,
  options: GetProvenanceOptions = {},
): Promise<ProvenanceSnapshot[]> {
  const allDomains: Array<{ domain: ProvenanceDomain; fetch: () => Promise<ProvenanceSnapshot[]> }> = [
    { domain: 'evidence', fetch: () => evidenceProvenance(userId) },
    { domain: 'hypothesis', fetch: () => hypothesisProvenance(userId) },
    { domain: 'aeonforge-candidate', fetch: () => aeonforgeProvenance(userId) },
    { domain: 'mechanistic-model', fetch: () => modelProvenance(userId) },
    { domain: 'intervention-outcome', fetch: () => outcomeProvenance(userId) },
  ]

  const active = options.domains
    ? allDomains.filter((d) => options.domains!.includes(d.domain))
    : allDomains

  const results = await Promise.all(active.map((d) => d.fetch()))
  let snapshots = results.flat()

  if (options.highImpactOnly) {
    snapshots = snapshots.filter((s) => s.highImpact)
  }

  return snapshots.sort((a, b) => b.uncertaintyScore - a.uncertaintyScore)
}
