import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { getReviewQueue, submitReviewDecision, type ReviewAction, type ReviewDomain } from '@/lib/graph/reviewer-workflow'
import { applyRateLimit } from '@/lib/rate-limit'

const REVIEWER_ROLES = ['ADMIN', 'CLINICIAN', 'RESEARCHER']
const VALID_ACTIONS: ReviewAction[] = ['approve', 'reject', 'escalate', 'request-info']
const VALID_DOMAINS: ReviewDomain[] = ['evidence', 'clinician-task', 'marketplace-discovery']

/**
 * GET /api/graph/reviews
 *
 * Returns the aggregated review queue for a reviewer.
 * Only ADMIN, CLINICIAN, and RESEARCHER roles may access this endpoint.
 *
 * Query params:
 *   domains – comma-separated domains to include
 *   limit   – max items per domain (default 50)
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !REVIEWER_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const rawDomains = searchParams.get('domains')
  const domainFilter = rawDomains
    ? rawDomains.split(',').filter((d): d is ReviewDomain => VALID_DOMAINS.includes(d as ReviewDomain))
    : undefined

  const limitParam = searchParams.get('limit')
  const limitPerDomain = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50

  const queue = await getReviewQueue({ domains: domainFilter, limitPerDomain })
  return NextResponse.json({ queue, count: queue.length })
}

/**
 * POST /api/graph/reviews
 *
 * Submit a review decision for a cross-domain entity.
 *
 * Body: { domain, entityId, action, comment? }
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !REVIEWER_ROLES.includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { domain, entityId, action, comment } = body as {
    domain?: string
    entityId?: string
    action?: string
    comment?: string
  }

  if (!domain || !VALID_DOMAINS.includes(domain as ReviewDomain)) {
    return NextResponse.json({ error: 'Invalid or missing domain' }, { status: 400 })
  }
  if (!entityId || typeof entityId !== 'string') {
    return NextResponse.json({ error: 'entityId is required' }, { status: 400 })
  }
  if (!action || !VALID_ACTIONS.includes(action as ReviewAction)) {
    return NextResponse.json({ error: 'Invalid or missing action' }, { status: 400 })
  }

  const result = await submitReviewDecision({
    domain: domain as ReviewDomain,
    entityId,
    action: action as ReviewAction,
    reviewerUserId: session.user.id,
    reviewerComment: comment,
  })

  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}
