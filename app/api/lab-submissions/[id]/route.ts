import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { patchLabSubmissionSchema } from '@/lib/validators/lab-submission'

/**
 * GET /api/lab-submissions/[id]
 * Full detail: submission metadata + package snapshot + linked lab results.
 * tokenHash is excluded; the plaintext token is never accessible post-creation.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const submission = await db.labSubmission.findFirst({
      where: { id, userId: session.user.id },
      select: {
        id: true,
        candidateId: true,
        labName: true,
        labContact: true,
        status: true,
        packageJson: true,
        requestedAssays: true,
        deadlineAt: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        // tokenHash intentionally excluded
        labResults: {
          orderBy: { measuredAt: 'asc' },
          select: {
            id: true,
            assayName: true,
            value: true,
            unit: true,
            operator: true,
            flag: true,
            assayType: true,
            lab: true,
            measuredAt: true,
            rawDataUri: true,
            notes: true,
            createdAt: true,
          },
        },
      },
    })

    if (!submission) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(submission)
  } catch (err) {
    logger.error('Failed to fetch lab submission', { error: err, id })
    return NextResponse.json({ error: 'Failed to fetch lab submission' }, { status: 500 })
  }
}

/**
 * PATCH /api/lab-submissions/[id]
 * Researcher can mark a submission COMPLETE or VOID.
 * Only non-terminal submissions can be patched (not already COMPLETE or VOID).
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

  const parsed = patchLabSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { status: newStatus, notes } = parsed.data

  try {
    const existing = await db.labSubmission.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, status: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (existing.status === 'COMPLETE' || existing.status === 'VOID') {
      return NextResponse.json(
        {
          error: 'Cannot update a terminal submission',
          currentStatus: existing.status,
        },
        { status: 409 },
      )
    }

    const updated = await db.labSubmission.update({
      where: { id },
      data: {
        status: newStatus,
        ...(notes !== undefined ? { notes } : {}),
      },
      select: {
        id: true,
        status: true,
        labName: true,
        deadlineAt: true,
        notes: true,
        updatedAt: true,
      },
    })

    logger.info('Lab submission patched', {
      submissionId: id,
      newStatus,
      userId: session.user.id,
    })

    return NextResponse.json(updated)
  } catch (err) {
    logger.error('Failed to patch lab submission', { error: err, id })
    return NextResponse.json({ error: 'Failed to update lab submission' }, { status: 500 })
  }
}
