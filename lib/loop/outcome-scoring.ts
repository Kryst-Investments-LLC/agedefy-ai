/**
 * Outcome-Indexed Feedback Scoring
 *
 * Strengthens feedback loops by scoring how effectively each validated
 * participant interaction contributes to measurable outcomes. The more
 * interactions that are correlated with positive biomarker deltas and
 * protocol completions, the stronger the loop score.
 *
 * @module lib/loop/outcome-scoring
 */

import { db } from '@/lib/db'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface OutcomeFeedbackScore {
  userId: string
  loopStrength: number
  interactionCount: number
  outcomeCount: number
  positiveDeltaRate: number
  protocolCompletionRate: number
  evidenceVerificationRate: number
  weightedScore: number
  components: OutcomeComponent[]
  computedAt: string
}

export interface OutcomeComponent {
  dimension: string
  value: number
  weight: number
  description: string
}

/* ------------------------------------------------------------------ */
/*  Scoring weights                                                   */
/* ------------------------------------------------------------------ */

const OUTCOME_WEIGHTS = {
  positiveDelta: 0.30,
  protocolCompletion: 0.25,
  evidenceVerification: 0.20,
  discoveryApproval: 0.15,
  adverseEventFreedom: 0.10,
} as const

/* ------------------------------------------------------------------ */
/*  Scoring engine                                                    */
/* ------------------------------------------------------------------ */

export async function computeOutcomeFeedbackScore(
  userId: string,
): Promise<OutcomeFeedbackScore> {
  const [
    outcomes,
    protocols,
    evidenceRecords,
    candidates,
    adverseEvents,
    biomarkers,
  ] = await Promise.all([
    db.interventionOutcome.findMany({ where: { userId }, select: { delta: true, confidenceScore: true } }),
    db.protocol.findMany({ where: { userId }, select: { status: true } }),
    db.evidenceRecord.findMany({ where: { createdByUserId: userId }, select: { reviewStatus: true } }),
    db.aeonForgeCandidate.findMany({ where: { userId }, select: { status: true } }),
    db.adverseEventReport.count({ where: { userId } }),
    db.biomarker.count({ where: { userId } }),
  ])

  // Positive delta rate: fraction of outcomes with positive deltas weighted by confidence
  const positiveDeltaOutcomes = outcomes.filter((o) => o.delta > 0)
  const positiveDeltaRate = outcomes.length > 0
    ? positiveDeltaOutcomes.reduce((sum, o) => sum + o.confidenceScore, 0) / outcomes.length
    : 0

  // Protocol completion rate
  const completedProtocols = protocols.filter((p) => p.status === 'completed')
  const protocolCompletionRate = protocols.length > 0
    ? completedProtocols.length / protocols.length
    : 0

  // Evidence verification rate
  const verifiedEvidence = evidenceRecords.filter((e) => e.reviewStatus === 'VERIFIED')
  const evidenceVerificationRate = evidenceRecords.length > 0
    ? verifiedEvidence.length / evidenceRecords.length
    : 0

  // Discovery approval rate
  const approvedCandidates = candidates.filter((c) => c.status === 'approved')
  const discoveryApprovalRate = candidates.length > 0
    ? approvedCandidates.length / candidates.length
    : 0

  // Adverse event freedom: inverse of adverse event frequency normalized by interactions
  const totalInteractions = biomarkers + protocols.length + outcomes.length
  const aeFrequency = totalInteractions > 0 ? adverseEvents / totalInteractions : 0
  const adverseEventFreedom = 1 - Math.min(aeFrequency * 10, 1) // Scale so ≥10 % is fully negative

  const components: OutcomeComponent[] = [
    { dimension: 'positiveDelta', value: positiveDeltaRate, weight: OUTCOME_WEIGHTS.positiveDelta, description: 'Confidence-weighted positive outcome rate' },
    { dimension: 'protocolCompletion', value: protocolCompletionRate, weight: OUTCOME_WEIGHTS.protocolCompletion, description: 'Protocol completion rate' },
    { dimension: 'evidenceVerification', value: evidenceVerificationRate, weight: OUTCOME_WEIGHTS.evidenceVerification, description: 'Evidence verification pass rate' },
    { dimension: 'discoveryApproval', value: discoveryApprovalRate, weight: OUTCOME_WEIGHTS.discoveryApproval, description: 'AeonForge discovery approval rate' },
    { dimension: 'adverseEventFreedom', value: adverseEventFreedom, weight: OUTCOME_WEIGHTS.adverseEventFreedom, description: 'Inverse adverse event frequency' },
  ]

  const weightedScore = components.reduce((sum, c) => sum + c.value * c.weight, 0)

  // Loop strength: how much the feedback loop is working (0-1 scale)
  // Requires multiple stages to have non-trivial data
  const stageCoverage = [
    outcomes.length > 0,
    protocols.length > 0,
    evidenceRecords.length > 0,
    candidates.length > 0,
    biomarkers > 0,
  ].filter(Boolean).length / 5

  const loopStrength = weightedScore * stageCoverage

  return {
    userId,
    loopStrength,
    interactionCount: totalInteractions,
    outcomeCount: outcomes.length,
    positiveDeltaRate,
    protocolCompletionRate,
    evidenceVerificationRate,
    weightedScore,
    components,
    computedAt: new Date().toISOString(),
  }
}
