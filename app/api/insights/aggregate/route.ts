/**
 * Aggregate Insights API
 *
 * GET /api/insights/aggregate — Returns population-level aggregate outcomes
 * with k-anonymity and differential privacy guarantees.
 *
 * POST /api/insights/aggregate — Trigger aggregation run (admin only).
 *
 * @module app/api/insights/aggregate/route
 */

import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { applyRateLimit } from '@/lib/rate-limit'
import { runOutcomeAggregation } from '@/lib/flywheel/outcome-aggregator'

/* ------------------------------------------------------------------ */
/*  GET — Read aggregate outcomes                                     */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const protocolId = searchParams.get('protocolId')
  const compoundId = searchParams.get('compoundId')
  const cohort = searchParams.get('cohort')
  const period = searchParams.get('period')
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100)

  const where: Record<string, unknown> = {}
  if (protocolId) where.protocolId = protocolId
  if (compoundId) where.compoundId = compoundId
  if (cohort) where.cohortBucket = cohort
  if (period) where.period = period

  const aggregates = await db.aggregateOutcome.findMany({
    where,
    orderBy: { computedAt: 'desc' },
    take: limit,
    include: {
      protocol: { select: { id: true, name: true } },
      compound: { select: { id: true, name: true, category: true } },
    },
  })

  // Compute summary stats
  const topProtocols = aggregates
    .filter((a) => a.protocolId && a.cohortBucket === 'all')
    .sort((a, b) => b.meanOutcomeScore - a.meanOutcomeScore)
    .slice(0, 10)

  return NextResponse.json({
    aggregates,
    topProtocols,
    total: aggregates.length,
    privacyGuarantee: {
      kAnonymity: 'k≥5 — each cohort bucket contains at least 5 individuals',
      differentialPrivacy: 'Laplace noise applied to all aggregate statistics',
      deIdentified: 'No personally identifiable information included',
    },
  })
}

/* ------------------------------------------------------------------ */
/*  POST — Trigger aggregation (admin only)                           */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins can trigger aggregation
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const now = new Date()
  const period = (body.period as string) ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const result = await runOutcomeAggregation({
    period,
    k: typeof body.k === 'number' ? body.k : undefined,
    epsilon: typeof body.epsilon === 'number' ? body.epsilon : undefined,
  })

  if (result.privacyBudgetExhausted) {
    // GOV-013: repeated/retried queries can't average out the DP noise — the
    // composition budget for this window is spent. Fail closed with 429.
    return NextResponse.json(
      { error: 'Differential-privacy budget exhausted for this period. Try again later.', result },
      { status: 429 },
    )
  }

  return NextResponse.json({ result })
}
