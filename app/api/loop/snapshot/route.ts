import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildLoopSnapshot } from '@/lib/loop/feedback-loop'
import { applyRateLimit } from '@/lib/rate-limit'

/**
 * GET /api/loop/snapshot
 *
 * Compute and persist the current feedback loop snapshot for the authenticated user.
 * Returns stage-by-stage metrics showing entity flow through the lifecycle.
 *
 * Query params:
 *   history – if "true", also return persisted historical snapshots (up to 30)
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const snapshot = await buildLoopSnapshot(session.user.id)

  const { searchParams } = new URL(request.url)
  const includeHistory = searchParams.get('history') === 'true'

  if (includeHistory) {
    const history = await db.feedbackLoopSnapshot.findMany({
      where: { userId: session.user.id },
      orderBy: { snapshotAt: 'desc' },
      take: 30,
    })
    return NextResponse.json({ snapshot, history })
  }

  return NextResponse.json({ snapshot })
}
