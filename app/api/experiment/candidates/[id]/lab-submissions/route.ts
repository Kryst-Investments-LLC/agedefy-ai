import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { Prisma } from '@prisma/client'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildLabPackage, generateSubmissionToken } from '@/lib/lab-package'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import {
  createLabSubmissionSchema,
  listLabSubmissionsQuerySchema,
} from '@/lib/validators/lab-submission'

/**
 * POST /api/experiment/candidates/[id]/lab-submissions
 *
 * Snapshot the candidate into a lab handoff package, generate a one-time
 * submission token, and record the LabSubmission.
 *
 * Candidate must be SCREENED or SENT_TO_LAB:
 *   - SCREENED → auto-advanced to SENT_TO_LAB + event written
 *   - SENT_TO_LAB → submission created without status change
 *
 * The plaintext token is returned ONCE in the response body and is never
 * stored server-side (only its SHA-256 hash is persisted).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: candidateId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const parsed = createLabSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data = parsed.data

  try {
    const candidate = await db.experimentCandidate.findFirst({
      where: { id: candidateId, userId: session.user.id },
    })

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    if (candidate.status !== 'SCREENED' && candidate.status !== 'SENT_TO_LAB') {
      return NextResponse.json(
        {
          error: 'Invalid candidate status',
          message: `Candidate must be SCREENED or SENT_TO_LAB to create a lab submission. Current status: ${candidate.status}`,
          currentStatus: candidate.status,
        },
        { status: 422 },
      )
    }

    const { token, tokenHash } = generateSubmissionToken()

    const ingestBaseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? ''

    // Build a placeholder package first (we need the submissionId, which we get
    // from the DB insert). We'll use a temporary ref and patch after.
    const tempPackage = buildLabPackage({
      submissionId: 'pending',
      candidate: {
        id: candidate.id,
        displayName: candidate.displayName,
        kind: candidate.kind,
        smiles: candidate.smiles,
        chemblId: candidate.chemblId,
        targetName: candidate.targetName,
        targetChemblId: candidate.targetChemblId,
        hypothesisNote: candidate.hypothesisNote,
        screenJson: candidate.screenJson,
        dockJson: candidate.dockJson,
      },
      requestedAssays: data.requestedAssays,
      labName: data.labName,
      labContact: data.labContact,
      deadlineAt: data.deadlineAt,
      ingestBaseUrl,
    })

    const result = await db.$transaction(async (tx) => {
      const submission = await tx.labSubmission.create({
        data: {
          candidateId,
          userId: session.user.id,
          labName: data.labName,
          labContact: data.labContact ?? null,
          tokenHash,
          status: 'PENDING',
          packageJson: {
            ...tempPackage,
            submission_ref: 'tbd',
          } as Prisma.InputJsonValue,
          requestedAssays: data.requestedAssays as Prisma.InputJsonValue,
          deadlineAt: data.deadlineAt ? new Date(data.deadlineAt) : null,
          notes: data.notes ?? null,
        },
      })

      // Patch the package with the real submission id
      const pkg = buildLabPackage({
        submissionId: submission.id,
        candidate: {
          id: candidate.id,
          displayName: candidate.displayName,
          kind: candidate.kind,
          smiles: candidate.smiles,
          chemblId: candidate.chemblId,
          targetName: candidate.targetName,
          targetChemblId: candidate.targetChemblId,
          hypothesisNote: candidate.hypothesisNote,
          screenJson: candidate.screenJson,
          dockJson: candidate.dockJson,
        },
        requestedAssays: data.requestedAssays,
        labName: data.labName,
        labContact: data.labContact,
        deadlineAt: data.deadlineAt,
        ingestBaseUrl,
      })

      await tx.labSubmission.update({
        where: { id: submission.id },
        data: { packageJson: pkg as unknown as Prisma.InputJsonValue },
      })

      // Auto-advance SCREENED → SENT_TO_LAB
      let advanced = false
      if (candidate.status === 'SCREENED') {
        await tx.experimentCandidate.update({
          where: { id: candidateId },
          data: { status: 'SENT_TO_LAB' },
        })
        await tx.experimentCandidateEvent.create({
          data: {
            candidateId,
            actorUserId: session.user.id,
            fromStatus: 'SCREENED',
            toStatus: 'SENT_TO_LAB',
            notes: `Auto-advanced on lab submission to ${data.labName}`,
          },
        })
        advanced = true
      }

      return { submission: { ...submission, packageJson: pkg }, advanced, pkg }
    })

    logger.info('Lab submission created', {
      submissionId: result.submission.id,
      candidateId,
      userId: session.user.id,
      advanced: result.advanced,
    })

    // Return the token ONCE — it is never stored and cannot be retrieved again.
    return NextResponse.json(
      {
        submission: {
          id: result.submission.id,
          status: result.submission.status,
          labName: result.submission.labName,
          labContact: result.submission.labContact,
          deadlineAt: result.submission.deadlineAt,
          createdAt: result.submission.createdAt,
          autoAdvancedToSentToLab: result.advanced,
        },
        submission_token: token,
        package: result.pkg,
      },
      { status: 201 },
    )
  } catch (err) {
    logger.error('Failed to create lab submission', { error: err, candidateId })
    return NextResponse.json({ error: 'Failed to create lab submission' }, { status: 500 })
  }
}

/**
 * GET /api/experiment/candidates/[id]/lab-submissions
 * List submissions for a candidate (no tokens, no packageJson).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: candidateId } = await params

  const qp = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = listLabSubmissionsQuerySchema.safeParse(qp)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { status, limit } = parsed.data

  try {
    const candidate = await db.experimentCandidate.findFirst({
      where: { id: candidateId, userId: session.user.id },
      select: { id: true },
    })
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    const submissions = await db.labSubmission.findMany({
      where: {
        candidateId,
        userId: session.user.id,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        labName: true,
        labContact: true,
        status: true,
        deadlineAt: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { labResults: true } },
        // tokenHash and packageJson intentionally excluded
      },
    })

    return NextResponse.json({ submissions })
  } catch (err) {
    logger.error('Failed to list lab submissions', { error: err, candidateId })
    return NextResponse.json({ error: 'Failed to list lab submissions' }, { status: 500 })
  }
}
