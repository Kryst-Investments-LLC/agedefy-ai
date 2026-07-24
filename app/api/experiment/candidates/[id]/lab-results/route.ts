import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { logAuditInTransactionOrThrow } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { createLabResultSchema } from '@/lib/validators/experiment'

/**
 * POST /api/experiment/candidates/[id]/lab-results
 * Attach a structured assay result to a candidate.
 * If the candidate is currently SENT_TO_LAB, automatically advances it
 * to RESULT_LOGGED and writes the transition event.
 */
export async function POST(
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

  const parsed = createLabResultSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data = parsed.data

  try {
    const candidate = await db.experimentCandidate.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!candidate) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const autoAdvance = candidate.status === 'SENT_TO_LAB'

    const result = await db.$transaction(async (tx) => {
      const labResult = await tx.candidateLabResult.create({
        data: {
          candidateId: id,
          assayName: data.assayName,
          value: data.value,
          unit: data.unit,
          operator: data.operator,
          flag: data.flag ?? null,
          assayType: data.assayType ?? null,
          lab: data.lab ?? null,
          measuredAt: new Date(data.measuredAt),
          rawDataUri: data.rawDataUri ?? null,
          notes: data.notes ?? null,
        },
      })

      if (autoAdvance) {
        await tx.experimentCandidate.update({
          where: { id },
          data: { status: 'RESULT_LOGGED' },
        })

        await tx.experimentCandidateEvent.create({
          data: {
            candidateId: id,
            actorUserId: session.user.id,
            fromStatus: 'SENT_TO_LAB',
            toStatus: 'RESULT_LOGGED',
            notes: `Auto-advanced on first lab result: ${data.assayName}`,
          },
        })

        // Tamper-evident, in-tx transition record (P0-CMP-014).
        await logAuditInTransactionOrThrow(tx, {
          actorUserId: session.user.id,
          actorEmail: session.user.email ?? undefined,
          tenantId: candidate.tenantId,
          action: 'candidate.transitioned',
          entityType: 'ExperimentCandidate',
          entityId: id,
          details: { fromStatus: 'SENT_TO_LAB', toStatus: 'RESULT_LOGGED', reason: 'lab result auto-advance' },
        })
      }

      return labResult
    })

    logger.info('Lab result logged', {
      candidateId: id,
      assayName: data.assayName,
      autoAdvanced: autoAdvance,
      userId: session.user.id,
    })

    return NextResponse.json(
      { result, autoAdvancedToResultLogged: autoAdvance },
      { status: 201 },
    )
  } catch (err) {
    logger.error('Failed to log lab result', { error: err, id })
    return NextResponse.json({ error: 'Failed to log lab result' }, { status: 500 })
  }
}
