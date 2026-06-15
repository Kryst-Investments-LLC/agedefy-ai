import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { Prisma } from '@prisma/client'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  isValidTransition,
  transitionCandidateSchema,
} from '@/lib/validators/experiment'

/**
 * PATCH /api/experiment/candidates/[id]/transition
 * Advance a candidate to the next lifecycle status.
 * Only forward adjacent moves are allowed (PROPOSED→SCREENED, etc.).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const parsed = transitionCandidateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { toStatus, notes, metadata } = parsed.data

  try {
    const candidate = await db.experimentCandidate.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!candidate) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!isValidTransition(candidate.status, toStatus)) {
      return NextResponse.json(
        {
          error: 'Invalid transition',
          message: `Cannot move from ${candidate.status} to ${toStatus}. Only the immediate next status is allowed.`,
          currentStatus: candidate.status,
          toStatus,
        },
        { status: 422 },
      )
    }

    const updated = await db.$transaction(async (tx) => {
      const c = await tx.experimentCandidate.update({
        where: { id },
        data: { status: toStatus },
      })

      await tx.experimentCandidateEvent.create({
        data: {
          candidateId: id,
          actorUserId: session.user.id,
          fromStatus: candidate.status,
          toStatus,
          notes: notes ?? null,
          metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      })

      return c
    })

    logger.info('Experiment candidate transitioned', {
      candidateId: id,
      from: candidate.status,
      to: toStatus,
      userId: session.user.id,
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (err) {
    logger.error('Failed to transition experiment candidate', { error: err, id })
    return NextResponse.json({ error: 'Failed to transition candidate' }, { status: 500 })
  }
}
