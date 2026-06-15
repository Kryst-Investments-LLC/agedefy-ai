import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * GET /api/experiment/candidates/[id]
 * Full detail for one candidate: fields + ordered event timeline + lab results.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const candidate = await db.experimentCandidate.findFirst({
      where: { id, userId: session.user.id },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
        labResults: { orderBy: { measuredAt: 'asc' } },
      },
    })

    if (!candidate) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(candidate, { status: 200 })
  } catch (err) {
    logger.error('Failed to fetch experiment candidate', { error: err, id })
    return NextResponse.json({ error: 'Failed to fetch candidate' }, { status: 500 })
  }
}
