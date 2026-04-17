/**
 * Federated Learning — Model Registry API
 *
 * GET  /api/fl/models — List models (public, filtered by task/status)
 * POST /api/fl/models — Register a new model version (admin)
 * GET  /api/fl/models/[id] — Get model details + participation stats
 *
 * @module app/api/fl/models/route
 */

import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { applyRateLimit } from '@/lib/rate-limit'

/* ------------------------------------------------------------------ */
/*  Validation                                                        */
/* ------------------------------------------------------------------ */

const createModelSchema = z.object({
  architecture: z.string().min(1).max(50),
  taskType: z.string().min(1).max(50).default('bio-age-delta'),
  epsilon: z.number().min(0).optional(),
})

/* ------------------------------------------------------------------ */
/*  GET — List federated models                                       */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const taskType = searchParams.get('taskType')
  const status = searchParams.get('status')
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)

  const where: Record<string, unknown> = {}
  if (taskType) where.taskType = taskType
  if (status) where.status = status

  const models = await db.federatedModel.findMany({
    where,
    orderBy: { version: 'desc' },
    take: limit,
    select: {
      id: true,
      version: true,
      architecture: true,
      taskType: true,
      aggregatedFromN: true,
      roundsCompleted: true,
      epsilon: true,
      accuracy: true,
      loss: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      _count: { select: { participations: true } },
    },
  })

  return NextResponse.json({ models })
}

/* ------------------------------------------------------------------ */
/*  POST — Register new model version (admin)                         */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createModelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Determine next version number
  const latest = await db.federatedModel.findFirst({
    where: { taskType: parsed.data.taskType },
    orderBy: { version: 'desc' },
    select: { version: true },
  })

  const nextVersion = (latest?.version ?? 0) + 1

  const model = await db.federatedModel.create({
    data: {
      version: nextVersion,
      architecture: parsed.data.architecture,
      taskType: parsed.data.taskType,
      epsilon: parsed.data.epsilon,
      status: 'training',
    },
  })

  await logAudit({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    action: 'fl.model.created',
    entityType: 'FederatedModel',
    entityId: model.id,
    details: JSON.stringify({ version: nextVersion, architecture: parsed.data.architecture }),
  })

  return NextResponse.json({ model }, { status: 201 })
}
