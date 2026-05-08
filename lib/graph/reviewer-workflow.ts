/**
 * Cross-Domain Reviewer Workflow
 *
 * Unified reviewer interface that spans science (EvidenceRecord),
 * clinical (ClinicianTask), and marketplace (MarketplaceDiscovery) domains.
 * Clinicians and researchers get one aggregated review queue instead of
 * per-domain UIs.
 *
 * @module lib/graph/reviewer-workflow
 */

import { db } from '@/lib/db'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type ReviewDomain = 'evidence' | 'clinician-task' | 'marketplace-discovery'
export type ReviewAction = 'approve' | 'reject' | 'escalate' | 'request-info'

export interface ReviewQueueItem {
  id: string
  domain: ReviewDomain
  entityId: string
  title: string
  summary: string
  priority: number
  uncertaintyScore: number
  currentStatus: string
  submittedAt: string
  submittedBy: string | null
  /** Tags for reviewers to filter (e.g. disease area, protocol category) */
  tags: string[]
}

export interface ReviewDecision {
  domain: ReviewDomain
  entityId: string
  action: ReviewAction
  reviewerUserId: string
  reviewerComment?: string
}

export interface ReviewResult {
  success: boolean
  entityId: string
  domain: ReviewDomain
  newStatus: string
}

/* ------------------------------------------------------------------ */
/*  Queue builders                                                    */
/* ------------------------------------------------------------------ */

async function pendingEvidenceReviews(limit: number): Promise<ReviewQueueItem[]> {
  const records = await db.evidenceRecord.findMany({
    where: { reviewStatus: { in: ['AUTO_QUEUED', 'IN_REVIEW', 'ESCALATED'] } },
    orderBy: [{ evidenceScore: 'desc' }, { createdAt: 'asc' }],
    take: limit,
  })
  return records.map((r) => ({
    id: `evidence:${r.id}`,
    domain: 'evidence' as const,
    entityId: r.id,
    title: r.title,
    summary: `${r.studyType} — ${r.evidenceDirection} (score: ${r.evidenceScore.toFixed(2)})`,
    priority: r.evidenceScore,
    uncertaintyScore: r.uncertaintyScore,
    currentStatus: r.reviewStatus,
    submittedAt: r.createdAt.toISOString(),
    submittedBy: r.createdByUserId,
    tags: [r.studyType, r.diseaseArea, r.provenanceType].filter(Boolean) as string[],
  }))
}

async function pendingClinicianTasks(limit: number): Promise<ReviewQueueItem[]> {
  const tasks = await db.clinicianTask.findMany({
    where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
    orderBy: [{ createdAt: 'asc' }],
    take: limit,
  })
  return tasks.map((t) => ({
    id: `clinician-task:${t.id}`,
    domain: 'clinician-task' as const,
    entityId: t.id,
    title: t.title,
    summary: t.description ?? '',
    priority: t.priority > 5 ? 1 : 0.5,
    uncertaintyScore: 0.3,
    currentStatus: t.status,
    submittedAt: t.createdAt.toISOString(),
    submittedBy: t.userId,
    tags: [t.description ?? ''].filter(Boolean),
  }))
}

async function pendingMarketplaceReviews(limit: number): Promise<ReviewQueueItem[]> {
  const discoveries = await db.marketplaceDiscovery.findMany({
    where: { status: { in: ['DRAFT', 'REVIEW'] } },
    orderBy: [{ createdAt: 'asc' }],
    take: limit,
  })
  return discoveries.map((d) => ({
    id: `marketplace-discovery:${d.id}`,
    domain: 'marketplace-discovery' as const,
    entityId: d.id,
    title: d.title,
    summary: d.summary?.slice(0, 200) ?? '',
    priority: 0.6,
    uncertaintyScore: 0.4,
    currentStatus: d.status,
    submittedAt: d.createdAt.toISOString(),
    submittedBy: d.scientistId,
    tags: [d.category].filter(Boolean) as string[],
  }))
}

/* ------------------------------------------------------------------ */
/*  Review action executors                                           */
/* ------------------------------------------------------------------ */

async function executeEvidenceReview(decision: ReviewDecision): Promise<ReviewResult> {
  const statusMap: Record<ReviewAction, string> = {
    approve: 'VERIFIED',
    reject: 'REJECTED',
    escalate: 'ESCALATED',
    'request-info': 'IN_REVIEW',
  }
  const newStatus = statusMap[decision.action]

  await db.evidenceRecord.update({
    where: { id: decision.entityId },
    data: {
      reviewStatus: newStatus as 'VERIFIED' | 'REJECTED' | 'ESCALATED' | 'IN_REVIEW',
      reviewedByUserId: decision.reviewerUserId,
      reviewedAt: new Date(),
      reviewConfidence: decision.action === 'approve' ? 0.9 : decision.action === 'reject' ? 0.1 : undefined,
    },
  })

  return { success: true, entityId: decision.entityId, domain: 'evidence', newStatus }
}

async function executeClinicianTaskReview(decision: ReviewDecision): Promise<ReviewResult> {
  const statusMap: Record<ReviewAction, string> = {
    approve: 'COMPLETED',
    reject: 'CANCELED',
    escalate: 'IN_PROGRESS',
    'request-info': 'PENDING',
  }
  const newStatus = statusMap[decision.action]

  await db.clinicianTask.update({
    where: { id: decision.entityId },
    data: {
      status: newStatus as 'COMPLETED' | 'CANCELED' | 'IN_PROGRESS' | 'PENDING',
    },
  })

  return { success: true, entityId: decision.entityId, domain: 'clinician-task', newStatus }
}

async function executeMarketplaceReview(decision: ReviewDecision): Promise<ReviewResult> {
  const statusMap: Record<ReviewAction, string> = {
    approve: 'PUBLISHED',
    reject: 'ARCHIVED',
    escalate: 'REVIEW',
    'request-info': 'REVIEW',
  }
  const newStatus = statusMap[decision.action]

  await db.marketplaceDiscovery.update({
    where: { id: decision.entityId },
    data: {
      status: newStatus as 'PUBLISHED' | 'ARCHIVED' | 'REVIEW',
    },
  })

  return { success: true, entityId: decision.entityId, domain: 'marketplace-discovery', newStatus }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export interface ReviewQueueOptions {
  domains?: ReviewDomain[]
  limitPerDomain?: number
}

/**
 * Retrieve the aggregated review queue for a reviewer, spanning all domains.
 * Items are sorted by priority (highest first).
 */
export async function getReviewQueue(
  options: ReviewQueueOptions = {},
): Promise<ReviewQueueItem[]> {
  const limit = options.limitPerDomain ?? 50
  const include = options.domains

  const fetchers: Array<{ domain: ReviewDomain; fetch: () => Promise<ReviewQueueItem[]> }> = [
    { domain: 'evidence', fetch: () => pendingEvidenceReviews(limit) },
    { domain: 'clinician-task', fetch: () => pendingClinicianTasks(limit) },
    { domain: 'marketplace-discovery', fetch: () => pendingMarketplaceReviews(limit) },
  ]

  const active = include ? fetchers.filter((f) => include.includes(f.domain)) : fetchers
  const results = await Promise.all(active.map((f) => f.fetch()))

  return results.flat().sort((a, b) => b.priority - a.priority)
}

/**
 * Submit a reviewer decision for an item in any domain.
 */
export async function submitReviewDecision(decision: ReviewDecision): Promise<ReviewResult> {
  switch (decision.domain) {
    case 'evidence':
      return executeEvidenceReview(decision)
    case 'clinician-task':
      return executeClinicianTaskReview(decision)
    case 'marketplace-discovery':
      return executeMarketplaceReview(decision)
    default:
      throw new Error(`Unknown review domain: ${decision.domain}`)
  }
}
