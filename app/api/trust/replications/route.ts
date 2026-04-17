import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { applyRateLimit } from '@/lib/rate-limit'
import {
  proposeReplication,
  fundReplication,
  listReplications,
} from '@/lib/trust/reproducibility'

/**
 * GET /api/trust/replications
 *
 * List replication studies. Optionally filter by proposer or status.
 *
 * Query params:
 *   proposedBy – userId of proposer
 *   status     – proposed | funded | in-progress | completed-confirmed | completed-refuted
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const proposedBy = searchParams.get('proposedBy') ?? undefined
  const status = searchParams.get('status') ?? undefined

  const replications = await listReplications({ proposedByUserId: proposedBy, status })
  return NextResponse.json({ replications })
}

/**
 * POST /api/trust/replications
 *
 * Propose or fund a replication study.
 *
 * Body: { action: "propose" | "fund", ...data }
 *
 * propose data: { originalEntityId, originalEntityType, title, rationale, validationCriteria, fundingGoalCents }
 * fund data:    { replicationId, amountCents }
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body as { action?: string }

  if (action === 'propose') {
    const { originalEntityId, originalEntityType, title, rationale, validationCriteria, fundingGoalCents } = body
    if (!originalEntityId || !originalEntityType || !title || !rationale || !fundingGoalCents) {
      return NextResponse.json({ error: 'Missing required fields for proposal' }, { status: 400 })
    }
    if (!Array.isArray(validationCriteria) || validationCriteria.length === 0) {
      return NextResponse.json({ error: 'validationCriteria must be a non-empty array' }, { status: 400 })
    }

    const result = await proposeReplication({
      originalEntityId,
      originalEntityType,
      title,
      rationale,
      validationCriteria,
      fundingGoalCents,
      proposedByUserId: session.user.id,
    })
    return NextResponse.json({ replication: result }, { status: 201 })
  }

  if (action === 'fund') {
    const { replicationId, amountCents } = body
    if (!replicationId || typeof amountCents !== 'number' || amountCents <= 0) {
      return NextResponse.json({ error: 'replicationId and positive amountCents required' }, { status: 400 })
    }

    const result = await fundReplication({
      replicationId,
      sponsorUserId: session.user.id,
      amountCents,
    })
    return NextResponse.json({ replication: result })
  }

  return NextResponse.json({ error: 'Invalid action. Use "propose" or "fund".' }, { status: 400 })
}
