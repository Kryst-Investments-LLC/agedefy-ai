import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { getUserAchievements } from '@/lib/gamification/achievement-evaluator'
import { getUserStreaks, recordDailyAction, type StreakType } from '@/lib/gamification/streak-tracker'
import { awardXP, getXPSummary, type XPAction, XP_ACTIONS } from '@/lib/gamification/xp-engine'
import { applyRateLimit } from '@/lib/rate-limit'

const VALID_STREAK_TYPES: StreakType[] = ['daily_login', 'biomarker_log', 'protocol_adherence', 'community']
const VALID_XP_ACTIONS = Object.keys(XP_ACTIONS) as XPAction[]

/**
 * GET /api/gamification
 *
 * Returns XP summary, streaks, and achievement status for the authenticated user.
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [xp, streaks, achievements] = await Promise.all([
    getXPSummary(session.user.id),
    getUserStreaks(session.user.id),
    getUserAchievements(session.user.id),
  ])

  return NextResponse.json({ xp, streaks, achievements })
}

/**
 * POST /api/gamification
 *
 * Record a gamification action.
 * Body: { action: XPAction, streakType?: StreakType }
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { action?: string; streakType?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const results: Record<string, unknown> = {}

  // Award XP if action is valid
  if (body.action && VALID_XP_ACTIONS.includes(body.action as XPAction)) {
    results.xp = await awardXP(session.user.id, body.action as XPAction)
  }

  // Record streak if type is valid
  if (body.streakType && VALID_STREAK_TYPES.includes(body.streakType as StreakType)) {
    results.streak = await recordDailyAction(session.user.id, body.streakType as StreakType)
  }

  if (Object.keys(results).length === 0) {
    return NextResponse.json(
      { error: 'Provide a valid action or streakType' },
      { status: 400 },
    )
  }

  return NextResponse.json(results)
}
