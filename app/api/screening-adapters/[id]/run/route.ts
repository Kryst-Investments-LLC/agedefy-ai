import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { Prisma } from '@prisma/client'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { callAdapter } from '@/lib/external-screening'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { runAdapterSchema } from '@/lib/validators/external-screening'

/**
 * POST /api/screening-adapters/[id]/run
 *
 * Invoke a registered external screening adapter for a SMILES string.
 * Persists an ExternalScreeningRun audit row regardless of outcome.
 *
 * Optional: pass candidateId + writeBack:true to write the normalized
 * result back into ExperimentCandidate.screenJson.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await applyRateLimit(request, { maxRequests: 60, windowMs: 60_000 })
  if (blocked) return blocked

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

  const parsed = runAdapterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { smiles, candidateId, include_pains, writeBack } = parsed.data

  // Load adapter — include secret for the outbound call, verify ownership
  const adapter = await db.externalScreeningAdapter.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!adapter) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!adapter.enabled) {
    return NextResponse.json({ error: 'Adapter is disabled' }, { status: 409 })
  }

  // Optionally verify the candidate exists and belongs to this user
  if (candidateId) {
    const candidate = await db.experimentCandidate.findFirst({
      where: { id: candidateId, userId: session.user.id },
      select: { id: true },
    })
    if (!candidate) {
      return NextResponse.json(
        { error: 'candidateId not found or not owned by you' },
        { status: 404 },
      )
    }
  }

  // Call the external endpoint
  const outcome = await callAdapter(adapter, { smiles, candidateId, include_pains })

  // Persist run log + optional write-back in one transaction
  const run = await db.$transaction(async (tx) => {
    const runRow = await tx.externalScreeningRun.create({
      data: {
        adapterId: id,
        candidateId: candidateId ?? null,
        smiles,
        durationMs: outcome.durationMs,
        statusCode: outcome.statusCode,
        success: outcome.success,
        rawResponse: (outcome.rawResponse ?? undefined) as Prisma.InputJsonValue | undefined,
        normalized: (outcome.normalized ?? undefined) as Prisma.InputJsonValue | undefined,
        errorMessage: outcome.errorMessage,
      },
    })

    if (writeBack && outcome.normalized && candidateId) {
      await tx.experimentCandidate.update({
        where: { id: candidateId },
        data: {
          screenJson: outcome.normalized as Prisma.InputJsonValue,
        },
      })
    }

    return runRow
  })

  logger.info('External screening adapter run complete', {
    adapterId: id,
    runId: run.id,
    success: outcome.success,
    durationMs: outcome.durationMs,
    userId: session.user.id,
  })

  if (!outcome.success) {
    return NextResponse.json(
      {
        run,
        error: outcome.errorMessage,
        normalized: null,
      },
      { status: 502 },
    )
  }

  return NextResponse.json(
    {
      run,
      normalized: outcome.normalized,
      wroteBack: writeBack && Boolean(outcome.normalized && candidateId),
    },
    { status: 200 },
  )
}
