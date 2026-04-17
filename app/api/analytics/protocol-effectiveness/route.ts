import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { applyRateLimit } from '@/lib/rate-limit'
import {
  computeProtocolEffectiveness,
  computeUserProtocolEffectiveness,
} from '@/lib/analytics/protocol-effectiveness'

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const protocolId = searchParams.get('protocolId')
  const windowDays = searchParams.get('windowDays')
    ? parseInt(searchParams.get('windowDays')!, 10)
    : undefined

  if (protocolId) {
    const result = await computeProtocolEffectiveness(protocolId, { windowDays })
    return NextResponse.json({ protocolId, effectiveness: result })
  }

  // Return effectiveness for all user protocols
  const results = await computeUserProtocolEffectiveness(session.user.id, { windowDays })
  return NextResponse.json({ protocols: results })
}
