import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { SupervisorAgent } from '@/lib/agents/supervisor'
import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { safeJsonParse } from '@/lib/safe-json'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantContext = await deriveTenantContextWithValidation({
    sessionUser: session.user,
    request,
  })

  if (!tenantContext) {
    return NextResponse.json({ error: 'Invalid tenant context' }, { status: 403 })
  }

  const { id: sessionId } = await context.params

  try {
    const agentSession = await db.agentSession.findUnique({ where: { id: sessionId } })

    if (!agentSession) {
      return NextResponse.json({ error: 'Agent session not found' }, { status: 404 })
    }

    if (agentSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (agentSession.status !== 'AWAITING_REVIEW') {
      return NextResponse.json(
        { error: `Session is not awaiting review (current: ${agentSession.status})` },
        { status: 409 },
      )
    }

    // Verify all linked review items have been resolved
    if (agentSession.reviewItemIds) {
      const reviewItemIds = safeJsonParse<string[]>(agentSession.reviewItemIds, [])
      const unresolvedItems = await db.reviewItem.findMany({
        where: { id: { in: reviewItemIds }, status: { notIn: ['RESOLVED', 'DISMISSED'] } },
        select: { id: true, status: true },
      })

      if (unresolvedItems.length > 0) {
        return NextResponse.json(
          {
            error: 'Not all review items have been cleared',
            unresolvedCount: unresolvedItems.length,
            unresolvedIds: unresolvedItems.map((r) => r.id),
          },
          { status: 409 },
        )
      }
    }

    const supervisor = new SupervisorAgent(session.user.id, tenantContext.tenantId)
    const result = await supervisor.resume(sessionId, session.user.email ?? session.user.id)

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      tenantId: tenantContext.tenantId,
      action: 'agent.session_resumed',
      entityType: 'AgentSession',
      entityId: sessionId,
      details: {
        status: result.status,
        safetyFlagCount: result.safetyFlags.length,
        reviewedBy: session.user.email,
      },
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    logger.error('Agent session resume failed', {
      sessionId,
      userId: session.user.id,
      error: message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
