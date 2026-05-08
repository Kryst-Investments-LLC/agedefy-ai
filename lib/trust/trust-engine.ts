/**
 * Trust Score Engine
 *
 * Computes trust scores for vendors, reviewers, sponsors, and scientists
 * grounded in evidence quality, review accuracy, outcome validation, and
 * marketplace interaction history.
 *
 * Trust scores are derived — not self-declared — from on-platform behavior.
 *
 * @module lib/trust/trust-engine
 */

import { db } from '@/lib/db'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type TrustActorRole = 'scientist' | 'sponsor' | 'reviewer' | 'clinician'

export interface TrustScore {
  actorId: string
  actorRole: TrustActorRole
  displayName: string
  overallScore: number
  components: TrustComponent[]
  computedAt: string
}

export interface TrustComponent {
  dimension: string
  score: number
  weight: number
  sampleSize: number
  description: string
}

/* ------------------------------------------------------------------ */
/*  Weights per dimension                                             */
/* ------------------------------------------------------------------ */

const WEIGHTS = {
  evidenceQuality: 0.30,
  reviewAccuracy: 0.25,
  outcomeValidation: 0.20,
  reputationHistory: 0.15,
  communityEngagement: 0.10,
} as const

/* ------------------------------------------------------------------ */
/*  Scientist trust computation                                       */
/* ------------------------------------------------------------------ */

export async function computeScientistTrust(userId: string): Promise<TrustScore | null> {
  const scientist = await db.marketplaceScientist.findUnique({
    where: { userId },
    include: {
      discoveries: { select: { id: true, status: true, createdAt: true } },
      fundingRequests: { select: { id: true, status: true } },
    },
  })
  if (!scientist) return null

  // Evidence quality: fraction of curator-submitted evidence that passed review
  const evidenceRecords = await db.evidenceRecord.findMany({
    where: { createdByUserId: userId },
    select: { reviewStatus: true, evidenceScore: true },
  })
  const verifiedEvidence = evidenceRecords.filter((e) => e.reviewStatus === 'VERIFIED')
  const evidenceQuality = evidenceRecords.length > 0
    ? verifiedEvidence.reduce((sum, e) => sum + e.evidenceScore, 0) / evidenceRecords.length
    : 0.5

  // Outcome validation: fraction of discoveries reaching APPROVED status
  const approvedDiscoveries = scientist.discoveries.filter((d) => d.status === 'PUBLISHED')
  const outcomeValidation = scientist.discoveries.length > 0
    ? approvedDiscoveries.length / scientist.discoveries.length
    : 0.5

  // Reputation history: normalized existing marketplace reputation score
  const reputationHistory = scientist.reputationScore

  // Community engagement: funded proposals / total proposals (proxy for community value)
  const fundedRequests = scientist.fundingRequests.filter((f) => f.status === 'COMMITTED' || f.status === 'CLOSED')
  const communityEngagement = scientist.fundingRequests.length > 0
    ? fundedRequests.length / scientist.fundingRequests.length
    : 0.3

  const components: TrustComponent[] = [
    { dimension: 'evidenceQuality', score: evidenceQuality, weight: WEIGHTS.evidenceQuality, sampleSize: evidenceRecords.length, description: 'Quality and verification rate of submitted evidence' },
    { dimension: 'outcomeValidation', score: outcomeValidation, weight: WEIGHTS.outcomeValidation, sampleSize: scientist.discoveries.length, description: 'Fraction of discoveries reaching approved status' },
    { dimension: 'reputationHistory', score: reputationHistory, weight: WEIGHTS.reputationHistory, sampleSize: 1, description: 'Platform-derived reputation score' },
    { dimension: 'communityEngagement', score: communityEngagement, weight: WEIGHTS.communityEngagement, sampleSize: scientist.fundingRequests.length, description: 'Successful funding conversion rate' },
  ]

  const overallScore = components.reduce((sum, c) => sum + c.score * c.weight, 0) / components.reduce((sum, c) => sum + c.weight, 0)

  // Persist updated reputation score back to marketplace profile
  await db.marketplaceScientist.update({
    where: { userId },
    data: { reputationScore: overallScore },
  })

  return {
    actorId: scientist.id,
    actorRole: 'scientist',
    displayName: scientist.displayName,
    overallScore,
    components,
    computedAt: new Date().toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/*  Sponsor trust computation                                         */
/* ------------------------------------------------------------------ */

export async function computeSponsorTrust(userId: string): Promise<TrustScore | null> {
  const sponsor = await db.marketplaceSponsor.findUnique({
    where: { userId },
    include: {
      transactions: { select: { id: true, status: true, amountCents: true } },
      dealRooms: { select: { id: true, status: true } },
    },
  })
  if (!sponsor) return null

  // Funding reliability: fraction of completed transactions
  const completedTx = sponsor.transactions.filter((t) => t.status === 'SETTLED' || t.status === 'RELEASED')
  const fundingReliability = sponsor.transactions.length > 0
    ? completedTx.length / sponsor.transactions.length
    : 0.5

  // Deal completion: fraction of deal rooms reaching COMPLETED status
  const completedDeals = sponsor.dealRooms.filter((d) => d.status === 'FUNDED' || d.status === 'CLOSED')
  const dealCompletion = sponsor.dealRooms.length > 0
    ? completedDeals.length / sponsor.dealRooms.length
    : 0.5

  // Capital commitment (normalized): total funded relative to available capital
  const totalFunded = completedTx.reduce((sum, t) => sum + t.amountCents, 0)
  const capitalCommitment = sponsor.capitalAvailableCents > 0
    ? Math.min(totalFunded / sponsor.capitalAvailableCents, 1)
    : 0

  const components: TrustComponent[] = [
    { dimension: 'fundingReliability', score: fundingReliability, weight: 0.40, sampleSize: sponsor.transactions.length, description: 'Transaction completion rate' },
    { dimension: 'dealCompletion', score: dealCompletion, weight: 0.35, sampleSize: sponsor.dealRooms.length, description: 'Deal room completion rate' },
    { dimension: 'capitalCommitment', score: capitalCommitment, weight: 0.25, sampleSize: 1, description: 'Ratio of capital deployed to capital available' },
  ]

  const overallScore = components.reduce((sum, c) => sum + c.score * c.weight, 0) / components.reduce((sum, c) => sum + c.weight, 0)

  return {
    actorId: sponsor.id,
    actorRole: 'sponsor',
    displayName: sponsor.organizationName,
    overallScore,
    components,
    computedAt: new Date().toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/*  Reviewer trust computation                                        */
/* ------------------------------------------------------------------ */

export async function computeReviewerTrust(userId: string): Promise<TrustScore | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  })
  if (!user || !['CLINICIAN', 'RESEARCHER', 'ADMIN'].includes(user.role)) return null

  // How many reviews has this user performed (evidence)
  const reviewedEvidence = await db.evidenceRecord.findMany({
    where: { reviewedByUserId: userId },
    select: { reviewStatus: true, reviewConfidence: true },
  })

  // Review consistency: average review confidence across reviewed items
  const avgConfidence = reviewedEvidence.length > 0
    ? reviewedEvidence.reduce((sum, e) => sum + (e.reviewConfidence ?? 0.5), 0) / reviewedEvidence.length
    : 0.5

  // Volume factor (log-scale so prolific reviewers get moderate boost)
  const volumeFactor = Math.min(Math.log10(reviewedEvidence.length + 1) / 3, 1)

  const components: TrustComponent[] = [
    { dimension: 'reviewConsistency', score: avgConfidence, weight: 0.50, sampleSize: reviewedEvidence.length, description: 'Average review confidence across decisions' },
    { dimension: 'reviewVolume', score: volumeFactor, weight: 0.30, sampleSize: reviewedEvidence.length, description: 'Review throughput (log-normalized)' },
    { dimension: 'roleWeight', score: user.role === 'CLINICIAN' ? 0.9 : user.role === 'RESEARCHER' ? 0.85 : 0.7, weight: 0.20, sampleSize: 1, description: 'Base trust from role credentials' },
  ]

  const overallScore = components.reduce((sum, c) => sum + c.score * c.weight, 0) / components.reduce((sum, c) => sum + c.weight, 0)

  return {
    actorId: userId,
    actorRole: 'reviewer',
    displayName: user.name ?? user.email ?? userId,
    overallScore,
    components,
    computedAt: new Date().toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/*  Persistence                                                       */
/* ------------------------------------------------------------------ */

const ROLE_TO_PRISMA: Record<TrustActorRole, 'SCIENTIST' | 'SPONSOR' | 'REVIEWER' | 'CLINICIAN'> = {
  scientist: 'SCIENTIST',
  sponsor: 'SPONSOR',
  reviewer: 'REVIEWER',
  clinician: 'CLINICIAN',
}

function dimensionValue(components: TrustComponent[], dim: string): number {
  return components.find((c) => c.dimension === dim)?.score ?? 0.5
}

async function persistTrustScore(userId: string, role: TrustActorRole, score: TrustScore): Promise<void> {
  await db.trustScore.create({
    data: {
      userId,
      role: ROLE_TO_PRISMA[role],
      overallScore: score.overallScore,
      evidenceScore: dimensionValue(score.components, 'evidenceQuality'),
      reviewScore: dimensionValue(score.components, 'reviewConsistency'),
      consistencyScore: dimensionValue(score.components, 'reviewVolume'),
      reputationScore: dimensionValue(score.components, 'reputationHistory'),
      engagementScore: dimensionValue(score.components, 'communityEngagement'),
      computedAt: new Date(),
    },
  })
}

/* ------------------------------------------------------------------ */
/*  Unified entry point                                               */
/* ------------------------------------------------------------------ */

export async function computeTrustScore(
  userId: string,
  role: TrustActorRole,
): Promise<TrustScore | null> {
  let score: TrustScore | null = null
  switch (role) {
    case 'scientist':
      score = await computeScientistTrust(userId)
      break
    case 'sponsor':
      score = await computeSponsorTrust(userId)
      break
    case 'reviewer':
    case 'clinician':
      score = await computeReviewerTrust(userId)
      break
    default:
      return null
  }

  if (score) {
    await persistTrustScore(userId, role, score)
  }
  return score
}
