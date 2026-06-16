import { NextRequest, NextResponse } from 'next/server'

import { Prisma } from '@prisma/client'

import { db } from '@/lib/db'
import { hashToken } from '@/lib/lab-package'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { labIngestSchema } from '@/lib/validators/lab-submission'

/**
 * POST /api/lab-submissions/ingest
 *
 * Token-authenticated endpoint for external labs to return assay results.
 * No user session is required — authentication is via the one-time submission
 * token issued at package creation.
 *
 * For each result in the batch:
 *   - Creates a CandidateLabResult linked to the LabSubmission
 *
 * Status transitions (all in one transaction):
 *   - If candidate is SENT_TO_LAB → advance to RESULT_LOGGED + write event
 *   - Submission: PENDING/PARTIAL → PARTIAL; if final:true → COMPLETE
 *
 * Rate-limited aggressively to deter token brute-force (10 req/min).
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const parsed = labIngestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { token, results, final } = parsed.data
  const tokenHash = hashToken(token)

  try {
    const submission = await db.labSubmission.findUnique({
      where: { tokenHash },
      include: { candidate: { select: { id: true, status: true, userId: true } } },
    })

    if (!submission) {
      // Return 404 (not 401) — don't reveal whether the token format is wrong vs. unknown.
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    if (submission.status === 'VOID') {
      return NextResponse.json(
        { error: 'This submission has been voided and cannot accept results' },
        { status: 409 },
      )
    }

    if (submission.status === 'COMPLETE') {
      return NextResponse.json(
        { error: 'This submission is already marked complete' },
        { status: 409 },
      )
    }

    const candidate = submission.candidate
    const autoAdvance = candidate.status === 'SENT_TO_LAB'
    const newSubmissionStatus = final ? 'COMPLETE' : 'PARTIAL'

    const { labResults, autoAdvanced } = await db.$transaction(async (tx) => {
      const created = await Promise.all(
        results.map((r) =>
          tx.candidateLabResult.create({
            data: {
              candidateId: candidate.id,
              submissionId: submission.id,
              assayName: r.assayName,
              value: r.value,
              unit: r.unit,
              operator: r.operator,
              flag: r.flag ?? null,
              assayType: r.assayType ?? null,
              lab: r.lab ?? null,
              measuredAt: new Date(r.measuredAt),
              rawDataUri: r.rawDataUri ?? null,
              notes: r.notes ?? null,
            },
          }),
        ),
      )

      await tx.labSubmission.update({
        where: { id: submission.id },
        data: { status: newSubmissionStatus },
      })

      if (autoAdvance) {
        await tx.experimentCandidate.update({
          where: { id: candidate.id },
          data: { status: 'RESULT_LOGGED' },
        })

        await tx.experimentCandidateEvent.create({
          data: {
            candidateId: candidate.id,
            actorUserId: candidate.userId,
            fromStatus: 'SENT_TO_LAB',
            toStatus: 'RESULT_LOGGED',
            notes: `Auto-advanced on lab result ingest from ${submission.labName} (${created.length} result${created.length !== 1 ? 's' : ''})`,
            metadata: {
              submissionId: submission.id,
              resultCount: created.length,
            } as Prisma.InputJsonValue,
          },
        })
      }

      return { labResults: created, autoAdvanced: autoAdvance }
    })

    logger.info('Lab results ingested', {
      submissionId: submission.id,
      candidateId: candidate.id,
      resultCount: labResults.length,
      autoAdvanced,
      final,
      newStatus: newSubmissionStatus,
    })

    return NextResponse.json(
      {
        ingested: labResults.length,
        submissionStatus: newSubmissionStatus,
        candidateAdvancedToResultLogged: autoAdvanced,
        labResultIds: labResults.map((r) => r.id),
      },
      { status: 201 },
    )
  } catch (err) {
    logger.error('Lab ingest failed', { error: err })
    return NextResponse.json({ error: 'Failed to ingest lab results' }, { status: 500 })
  }
}
