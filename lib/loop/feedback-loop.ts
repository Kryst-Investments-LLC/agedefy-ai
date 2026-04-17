/**
 * Feedback Loop Orchestrator
 *
 * Connects the full Biozephyra lifecycle:
 *   discovery → evaluation → procurement → clinical review →
 *   intervention tracking → outcome monitoring → funding
 *
 * Each stage is inspectable and measurable. The orchestrator tracks
 * how entities flow between stages and where they stall.
 *
 * @module lib/loop/feedback-loop
 */

import { db } from '@/lib/db'

/* ------------------------------------------------------------------ */
/*  Pipeline Stage Types                                              */
/* ------------------------------------------------------------------ */

export type LoopStage =
  | 'discovery'
  | 'evaluation'
  | 'procurement'
  | 'clinical-review'
  | 'intervention'
  | 'outcome-monitoring'
  | 'funding'

export interface StageMetrics {
  stage: LoopStage
  entityCount: number
  avgDwellDays: number
  conversionRate: number
  /** IDs of entities currently in this stage */
  activeEntityIds: string[]
}

export interface LoopSnapshot {
  userId: string
  stages: StageMetrics[]
  totalEntities: number
  fullLoopCompletions: number
  avgLoopDurationDays: number
  generatedAt: string
}

/* ------------------------------------------------------------------ */
/*  Stage measurement helpers                                         */
/* ------------------------------------------------------------------ */

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)
}

async function measureDiscoveryStage(userId: string): Promise<StageMetrics> {
  const candidates = await db.aeonForgeCandidate.findMany({
    where: { userId },
    select: { id: true, status: true, createdAt: true },
  })
  const active = candidates.filter((c) => c.status === 'pending' || c.status === 'simulating')
  const evaluated = candidates.filter((c) => c.status !== 'pending' && c.status !== 'simulating')

  return {
    stage: 'discovery',
    entityCount: candidates.length,
    avgDwellDays: candidates.length > 0
      ? candidates.reduce((sum, c) => sum + daysBetween(c.createdAt, new Date()), 0) / candidates.length
      : 0,
    conversionRate: candidates.length > 0 ? evaluated.length / candidates.length : 0,
    activeEntityIds: active.map((c) => c.id),
  }
}

async function measureEvaluationStage(userId: string): Promise<StageMetrics> {
  const evidence = await db.evidenceRecord.findMany({
    where: { createdByUserId: userId },
    select: { id: true, reviewStatus: true, createdAt: true },
  })
  const pending = evidence.filter((e) => e.reviewStatus === 'AUTO_QUEUED' || e.reviewStatus === 'IN_REVIEW')
  const reviewed = evidence.filter((e) => e.reviewStatus === 'VERIFIED' || e.reviewStatus === 'REJECTED')

  return {
    stage: 'evaluation',
    entityCount: evidence.length,
    avgDwellDays: evidence.length > 0
      ? evidence.reduce((sum, e) => sum + daysBetween(e.createdAt, new Date()), 0) / evidence.length
      : 0,
    conversionRate: evidence.length > 0 ? reviewed.length / evidence.length : 0,
    activeEntityIds: pending.map((e) => e.id),
  }
}

async function measureProcurementStage(userId: string): Promise<StageMetrics> {
  const orders = await db.marketplaceOrder.findMany({
    where: { userId },
    select: { id: true, status: true, orderedAt: true },
  })
  const active = orders.filter((o) => o.status === 'PENDING' || o.status === 'PAID')
  const delivered = orders.filter((o) => o.status === 'DELIVERED')

  return {
    stage: 'procurement',
    entityCount: orders.length,
    avgDwellDays: orders.length > 0
      ? orders.reduce((sum, o) => sum + daysBetween(o.orderedAt, new Date()), 0) / orders.length
      : 0,
    conversionRate: orders.length > 0 ? delivered.length / orders.length : 0,
    activeEntityIds: active.map((o) => o.id),
  }
}

async function measureClinicalReviewStage(userId: string): Promise<StageMetrics> {
  const tasks = await db.clinicianTask.findMany({
    where: { userId },
    select: { id: true, status: true, createdAt: true },
  })
  const open = tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS')
  const resolved = tasks.filter((t) => t.status === 'COMPLETED')

  return {
    stage: 'clinical-review',
    entityCount: tasks.length,
    avgDwellDays: tasks.length > 0
      ? tasks.reduce((sum, t) => sum + daysBetween(t.createdAt, new Date()), 0) / tasks.length
      : 0,
    conversionRate: tasks.length > 0 ? resolved.length / tasks.length : 0,
    activeEntityIds: open.map((t) => t.id),
  }
}

async function measureInterventionStage(userId: string): Promise<StageMetrics> {
  const protocols = await db.protocol.findMany({
    where: { userId },
    select: { id: true, status: true, createdAt: true },
  })
  const active = protocols.filter((p) => p.status === 'active')
  const completed = protocols.filter((p) => p.status === 'completed')

  return {
    stage: 'intervention',
    entityCount: protocols.length,
    avgDwellDays: protocols.length > 0
      ? protocols.reduce((sum, p) => sum + daysBetween(p.createdAt, new Date()), 0) / protocols.length
      : 0,
    conversionRate: protocols.length > 0 ? completed.length / protocols.length : 0,
    activeEntityIds: active.map((p) => p.id),
  }
}

async function measureOutcomeMonitoringStage(userId: string): Promise<StageMetrics> {
  const outcomes = await db.interventionOutcome.findMany({
    where: { userId },
    select: { id: true, confidenceScore: true, createdAt: true },
  })
  const highConfidence = outcomes.filter((o) => o.confidenceScore >= 0.7)

  return {
    stage: 'outcome-monitoring',
    entityCount: outcomes.length,
    avgDwellDays: outcomes.length > 0
      ? outcomes.reduce((sum, o) => sum + daysBetween(o.createdAt, new Date()), 0) / outcomes.length
      : 0,
    conversionRate: outcomes.length > 0 ? highConfidence.length / outcomes.length : 0,
    activeEntityIds: outcomes.map((o) => o.id),
  }
}

async function measureFundingStage(userId: string): Promise<StageMetrics> {
  const scientist = await db.marketplaceScientist.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!scientist) {
    return { stage: 'funding', entityCount: 0, avgDwellDays: 0, conversionRate: 0, activeEntityIds: [] }
  }

  const requests = await db.marketplaceFundingRequest.findMany({
    where: { scientistId: scientist.id },
    select: { id: true, status: true, createdAt: true },
  })
  const open = requests.filter((r) => r.status === 'OPEN')
  const funded = requests.filter((r) => r.status === 'COMMITTED' || r.status === 'CLOSED')

  return {
    stage: 'funding',
    entityCount: requests.length,
    avgDwellDays: requests.length > 0
      ? requests.reduce((sum, r) => sum + daysBetween(r.createdAt, new Date()), 0) / requests.length
      : 0,
    conversionRate: requests.length > 0 ? funded.length / requests.length : 0,
    activeEntityIds: open.map((r) => r.id),
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Build a snapshot of the full feedback loop for a user.
 * Shows entity counts, dwell times, and conversion rates per stage.
 * Persists the snapshot to the FeedbackLoopSnapshot table for longitudinal tracking.
 */
export async function buildLoopSnapshot(userId: string): Promise<LoopSnapshot> {
  const stages = await Promise.all([
    measureDiscoveryStage(userId),
    measureEvaluationStage(userId),
    measureProcurementStage(userId),
    measureClinicalReviewStage(userId),
    measureInterventionStage(userId),
    measureOutcomeMonitoringStage(userId),
    measureFundingStage(userId),
  ])

  const totalEntities = stages.reduce((sum, s) => sum + s.entityCount, 0)

  // Full loop completions: min entity count across all non-zero stages
  const nonZeroStages = stages.filter((s) => s.entityCount > 0)
  const fullLoopCompletions = nonZeroStages.length === stages.length
    ? Math.min(...stages.map((s) => Math.floor(s.entityCount * s.conversionRate)))
    : 0

  const avgLoopDurationDays = stages.reduce((sum, s) => sum + s.avgDwellDays, 0)

  const snapshot: LoopSnapshot = {
    userId,
    stages,
    totalEntities,
    fullLoopCompletions,
    avgLoopDurationDays,
    generatedAt: new Date().toISOString(),
  }

  // Persist snapshot for longitudinal tracking
  const stageMap = Object.fromEntries(stages.map((s) => [s.stage, s]))
  const loopStrength = stages.length > 0
    ? stages.reduce((sum, s) => sum + s.conversionRate, 0) / stages.length
    : 0

  await db.feedbackLoopSnapshot.create({
    data: {
      userId,
      loopStrength,
      discoveryScore: stageMap['discovery']?.conversionRate ?? 0,
      evaluationScore: stageMap['evaluation']?.conversionRate ?? 0,
      procurementScore: stageMap['procurement']?.conversionRate ?? 0,
      clinicalReviewScore: stageMap['clinical-review']?.conversionRate ?? 0,
      interventionScore: stageMap['intervention']?.conversionRate ?? 0,
      outcomeScore: stageMap['outcome-monitoring']?.conversionRate ?? 0,
      fundingScore: stageMap['funding']?.conversionRate ?? 0,
    },
  })

  return snapshot
}
