import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { buildMissionControl, type MissionControlRole } from '@/lib/loop/mission-control'
import { computeOutcomeFeedbackScore } from '@/lib/loop/outcome-scoring'
import { applyRateLimit } from '@/lib/rate-limit'

const ROLE_MAP: Record<string, MissionControlRole> = {
  MEMBER: 'user',
  CLINICIAN: 'clinician',
  RESEARCHER: 'user',
  ADMIN: 'operator',
}

/**
 * GET /api/mission-control
 *
 * Returns the mission-control workspace for the authenticated user.
 * The view adapts based on the user's role (member → user, clinician → clinician, admin → operator).
 *
 * Query params:
 *   includeOutcomeScore – if "true", also compute the outcome-indexed feedback score
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 15, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = ROLE_MAP[session.user.role ?? 'MEMBER'] ?? 'user'
  const includeOutcomeScore = new URL(request.url).searchParams.get('includeOutcomeScore') === 'true'

  const workspace = await buildMissionControl(session.user.id, role)

  if (includeOutcomeScore) {
    const outcomeScore = await computeOutcomeFeedbackScore(session.user.id)
    return NextResponse.json({ workspace, outcomeScore })
  }

  return NextResponse.json({ workspace })
}
