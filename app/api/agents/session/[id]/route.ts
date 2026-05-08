import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { applyRateLimit } from '@/lib/rate-limit'
import { safeJsonParse } from '@/lib/safe-json'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: sessionId } = await context.params

  const agentSession = await db.agentSession.findUnique({
    where: { id: sessionId },
    include: {
      steps: { orderBy: { stepIndex: 'asc' } },
    },
  })

  if (!agentSession) {
    return NextResponse.json({ error: 'Agent session not found' }, { status: 404 })
  }

  if (agentSession.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = agentSession.result ? safeJsonParse<unknown>(agentSession.result, null) : null

  return NextResponse.json({
    id: agentSession.id,
    goal: agentSession.goal,
    status: agentSession.status,
    createdAt: agentSession.createdAt,
    updatedAt: agentSession.updatedAt,
    completedAt: agentSession.completedAt,
    resumedAt: agentSession.resumedAt,
    reviewedBy: agentSession.reviewedBy,
    steps: agentSession.steps,
    result,
  })
}
