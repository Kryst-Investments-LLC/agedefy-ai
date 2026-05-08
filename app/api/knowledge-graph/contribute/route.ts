import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'

const contributionSchema = z.object({
  entityType: z.enum(['pathway-link', 'interaction', 'biomarker-effect', 'study-link']),
  payload: z.record(z.unknown()).refine(
    (obj) => Object.keys(obj).length > 0,
    { message: 'payload must not be empty' },
  ),
  rationale: z.string().max(2000).optional(),
})

/**
 * POST /api/knowledge-graph/contribute
 *
 * Submit a community contribution for the longevity knowledge graph.
 * Creates a PendingGraphContribution that must be reviewed before merging.
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = contributionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const contribution = await db.pendingGraphContribution.create({
    data: {
      contributorId: session.user.id,
      entityType: parsed.data.entityType,
      payload: JSON.stringify({
        ...parsed.data.payload,
        rationale: parsed.data.rationale,
      }),
      status: 'PENDING',
    },
  })

  logger.info('Knowledge graph contribution submitted', {
    id: contribution.id,
    entityType: parsed.data.entityType,
    contributor: session.user.id,
  })

  return NextResponse.json(contribution, { status: 201 })
}

/**
 * GET /api/knowledge-graph/contribute
 *
 * List contributions. Users see their own. ADMIN/RESEARCHER see all pending.
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status') ?? undefined
  const role = (session.user as { role?: string }).role

  const where: Record<string, unknown> = {}

  // Only ADMIN or RESEARCHER can see all contributions
  if (role !== 'ADMIN' && role !== 'RESEARCHER') {
    where.contributorId = session.user.id
  }

  if (statusFilter && ['PENDING', 'APPROVED', 'REJECTED'].includes(statusFilter)) {
    where.status = statusFilter
  }

  const contributions = await db.pendingGraphContribution.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      entityType: true,
      payload: true,
      status: true,
      reviewNotes: true,
      createdAt: true,
      contributor: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ contributions })
}
