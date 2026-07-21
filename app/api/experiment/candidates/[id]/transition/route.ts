import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { Prisma } from '@prisma/client'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { recordCandidateTransition } from '@/lib/observability/telemetry'
import { requireAuthWithRole } from '@/lib/rbac'
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
  const authResult = requireAuthWithRole(session, 'RESEARCHER', 'CLINICIAN', 'ADMIN')
  if (authResult instanceof NextResponse) return authResult

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
      include: { _count: { select: { labResults: true } } },
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

    const blockers: string[] = []
    if (toStatus === 'SCREENED') {
      if (!candidate.smiles) blockers.push('A molecular structure is required before screening can complete.')
      if (!candidate.screenJson) blockers.push('A persisted screening result is required before promotion.')
    }
    if (toStatus === 'SENT_TO_LAB') {
      if (!candidate.screenJson) blockers.push('The candidate must retain its screening result.')
      if (!metadata?.labSubmissionId && !metadata?.croOrderId) {
        blockers.push('A labSubmissionId or croOrderId is required before lab dispatch.')
      }
    }
    if (toStatus === 'RESULT_LOGGED' && candidate._count.labResults < 1) {
      blockers.push('At least one persisted laboratory result is required.')
    }
    if (toStatus === 'FED_BACK' && candidate.feedbackScore == null) {
      blockers.push('A computed feedback score is required before closing the feedback loop.')
    }

    if (blockers.length > 0) {
      return NextResponse.json(
        { error: 'Transition prerequisites not met', currentStatus: candidate.status, toStatus, blockers },
        { status: 422 },
      )
    }

    // When did the candidate enter its current status? (the latest event whose
    // toStatus is the current status) — used for the stage-latency SLI.
    const enteredCurrentAt = await db.experimentCandidateEvent.findFirst({
      where: { candidateId: id, toStatus: candidate.status },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })

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

    recordCandidateTransition({
      fromStatus: candidate.status,
      toStatus,
      stageDurationMs: enteredCurrentAt ? Date.now() - enteredCurrentAt.createdAt.getTime() : undefined,
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
