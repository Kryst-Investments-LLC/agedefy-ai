/**
 * Federated Learning — Participation API
 *
 * POST /api/fl/participate — User registers for FL training round
 * GET  /api/fl/participate — User's FL participation history
 *
 * @module app/api/fl/participate/route
 */

import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { hasGdprConsent } from '@/lib/consent'
import { logAudit } from '@/lib/audit'
import { applyRateLimit } from '@/lib/rate-limit'
import { env } from '@/lib/env'
import { checkEpsilonBudget } from '@/lib/fl/round-aggregation'

/* ------------------------------------------------------------------ */
/*  Validation                                                        */
/* ------------------------------------------------------------------ */

const participateSchema = z.object({
  modelId: z.string().min(1),
  round: z.number().int().min(1),
  localSampleSize: z.number().int().min(1),
  localLoss: z.number().optional(),
  epsilonSpent: z.number().min(0).optional(),
})

/* ------------------------------------------------------------------ */
/*  GET — Participation history                                       */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  // Feature flag gate — ENABLE_FEDERATED_LEARNING defaults OFF
  if (env.ENABLE_FEDERATED_LEARNING !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const participations = await db.fLParticipation.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      model: {
        select: {
          id: true,
          version: true,
          taskType: true,
          architecture: true,
          status: true,
        },
      },
    },
  })

  return NextResponse.json({
    participations,
    totalRounds: participations.length,
    totalEpsilonSpent: participations.reduce((sum, p) => sum + (p.epsilonSpent ?? 0), 0),
  })
}

/* ------------------------------------------------------------------ */
/*  POST — Record participation in a round                            */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  // Feature flag gate — ENABLE_FEDERATED_LEARNING defaults OFF
  if (env.ENABLE_FEDERATED_LEARNING !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check FL consent
  const hasConsent = await hasGdprConsent(session.user.id, 'research-usage')
  if (!hasConsent) {
    return NextResponse.json(
      {
        error: 'Consent required',
        code: 'FL_CONSENT_REQUIRED',
        message: 'You must grant "Research Data Usage" consent to participate in federated learning. Visit /account/consent to update your preferences.',
      },
      { status: 403 },
    )
  }

  const body = await request.json()
  const parsed = participateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Verify model exists and is in training
  const model = await db.federatedModel.findUnique({
    where: { id: parsed.data.modelId },
    select: { id: true, status: true },
  })

  if (!model) {
    return NextResponse.json({ error: 'Model not found' }, { status: 404 })
  }

  if (model.status !== 'training') {
    return NextResponse.json(
      { error: 'Model is not accepting training contributions' },
      { status: 409 },
    )
  }

  // Enforce the participant's cumulative DP budget for this model. The recorded
  // per-round epsilonSpent values sum to the participant's privacy spend; a new
  // contribution is rejected if it would push them over budget.
  const requestedEpsilon = parsed.data.epsilonSpent ?? 0
  if (requestedEpsilon > 0) {
    const prior = await db.fLParticipation.aggregate({
      where: { userId: session.user.id, modelId: parsed.data.modelId },
      _sum: { epsilonSpent: true },
    })
    const budget = checkEpsilonBudget(prior._sum.epsilonSpent ?? 0, requestedEpsilon)
    if (!budget.allowed) {
      return NextResponse.json(
        {
          error: 'Differential-privacy budget exceeded',
          code: 'FL_DP_BUDGET_EXCEEDED',
          reason: budget.reason,
          remaining: budget.remaining,
        },
        { status: 403 },
      )
    }
  }

  // Record participation
  const participation = await db.fLParticipation.create({
    data: {
      userId: session.user.id,
      modelId: parsed.data.modelId,
      round: parsed.data.round,
      localSampleSize: parsed.data.localSampleSize,
      localLoss: parsed.data.localLoss,
      epsilonSpent: parsed.data.epsilonSpent,
      status: 'completed',
    },
  })

  // Update model aggregation stats
  await db.federatedModel.update({
    where: { id: parsed.data.modelId },
    data: {
      aggregatedFromN: { increment: 1 },
      roundsCompleted: parsed.data.round,
    },
  })

  await logAudit({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    action: 'fl.participation.recorded',
    entityType: 'FLParticipation',
    entityId: participation.id,
    details: JSON.stringify({
      modelId: parsed.data.modelId,
      round: parsed.data.round,
      epsilonSpent: parsed.data.epsilonSpent,
    }),
  })

  return NextResponse.json({ participation }, { status: 201 })
}
