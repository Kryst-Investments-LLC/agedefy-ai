import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { applyRateLimit } from '@/lib/rate-limit'
import { computeTrustScore, type TrustActorRole } from '@/lib/trust/trust-engine'

const VALID_ROLES: TrustActorRole[] = ['scientist', 'sponsor', 'reviewer', 'clinician']

/**
 * GET /api/trust/scores
 *
 * Compute and return the trust score for the authenticated user.
 *
 * Query params:
 *   role – actor role to compute trust for (scientist | sponsor | reviewer | clinician)
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role') as TrustActorRole | null

  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { error: 'Invalid or missing role. Use: scientist, sponsor, reviewer, clinician' },
      { status: 400 },
    )
  }

  const score = await computeTrustScore(session.user.id, role)
  if (!score) {
    return NextResponse.json({ error: 'No trust profile found for this role' }, { status: 404 })
  }

  return NextResponse.json({ trustScore: score })
}
