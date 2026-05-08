import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { applyRateLimit } from '@/lib/rate-limit'

/**
 * GET /api/wearables/data?limit=20
 *
 * Returns the authenticated user's most recent wearable data records,
 * parsed from their PartnerDataRecord entries where source=WEARABLE.
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100)

  const records = await db.partnerDataRecord.findMany({
    where: {
      userId: session.user.id,
      source: 'WEARABLE',
    },
    orderBy: { receivedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      partnerId: true,
      label: true,
      payload: true,
      receivedAt: true,
    },
  })

  const parsed = records.map((r) => {
    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(r.payload)
    } catch {
      // leave empty
    }
    return {
      id: r.id,
      provider: r.partnerId?.replace('terra:', '') ?? 'unknown',
      label: r.label,
      activityContext: payload.activityContext as string | undefined,
      deviceManufacturer: payload.deviceManufacturer as string | undefined,
      metrics: Array.isArray(payload.metrics) ? payload.metrics : [],
      timestamp: (payload.timestamp as string) ?? r.receivedAt.toISOString(),
    }
  })

  return NextResponse.json({ records: parsed })
}
