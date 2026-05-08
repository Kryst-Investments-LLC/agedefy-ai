import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { computeAndPersistBioAge } from '@/lib/bio-age/compute-bio-age'
import { db } from '@/lib/db'
import { applyRateLimit } from '@/lib/rate-limit'
import { safeJsonParse } from '@/lib/safe-json'

/**
 * POST /api/bio-age
 *
 * Compute and persist a new biological age snapshot for the authenticated user.
 * Body: { chronologicalAge: number }
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { chronologicalAge?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { chronologicalAge } = body
  if (typeof chronologicalAge !== 'number' || chronologicalAge < 1 || chronologicalAge > 150) {
    return NextResponse.json(
      { error: 'chronologicalAge must be a number between 1 and 150' },
      { status: 400 },
    )
  }

  const result = await computeAndPersistBioAge(
    session.user.id,
    chronologicalAge,
    (session.user as Record<string, unknown>).tenantId as string | undefined ?? 'default',
  )

  return NextResponse.json({
    snapshotId: result.snapshotId,
    biologicalAge: result.biologicalAge,
    chronologicalAge: result.chronologicalAge,
    delta: result.delta,
    hallmarkScores: result.hallmarkScores,
    confidence: result.confidence,
    biomarkerCount: Object.keys(result.inputSummary).length,
  })
}

/**
 * GET /api/bio-age
 *
 * Return the user's biological age snapshot timeline.
 * Query params:
 *   limit – max results (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limitParam = parseInt(searchParams.get('limit') || '20', 10)
  const limit = Math.min(Math.max(1, limitParam), 100)

  const snapshots = await db.biologicalAgeSnapshot.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      biologicalAge: true,
      chronologicalAge: true,
      hallmarkScores: true,
      confidence: true,
      createdAt: true,
    },
  })

  const timeline = snapshots.map((s) => ({
    id: s.id,
    biologicalAge: s.biologicalAge,
    chronologicalAge: s.chronologicalAge,
    delta: Math.round((s.biologicalAge - s.chronologicalAge) * 10) / 10,
    hallmarkScores: typeof s.hallmarkScores === 'string' ? safeJsonParse<unknown>(s.hallmarkScores, null) : s.hallmarkScores,
    confidence: s.confidence,
    createdAt: s.createdAt,
  }))

  return NextResponse.json({
    snapshots: timeline,
    count: timeline.length,
    latest: timeline[0] ?? null,
  })
}
