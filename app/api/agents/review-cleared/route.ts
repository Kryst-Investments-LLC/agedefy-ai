import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { requireAuthWithRole } from '@/lib/rbac'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  const authResult = requireAuthWithRole(session, 'ADMIN', 'CLINICIAN')
  if (authResult instanceof NextResponse) return authResult

  const tenantContext = await deriveTenantContextWithValidation({
    sessionUser: authResult.user,
    request,
  })

  if (!tenantContext) {
    return NextResponse.json({ error: 'Invalid tenant context' }, { status: 403 })
  }

  const body = (await request.json()) as { reviewItemId?: string }

  if (!body.reviewItemId || typeof body.reviewItemId !== 'string') {
    return NextResponse.json({ error: 'reviewItemId is required' }, { status: 400 })
  }

  const reviewItem = await db.reviewItem.findUnique({
    where: { id: body.reviewItemId },
  })

  if (!reviewItem) {
    return NextResponse.json({ error: 'Review item not found' }, { status: 404 })
  }

  if (reviewItem.relatedEntityType !== 'AgentSession' || !reviewItem.relatedEntityId) {
    return NextResponse.json({ error: 'Review item is not linked to an agent session' }, { status: 400 })
  }

  const agentSession = await db.agentSession.findUnique({
    where: { id: reviewItem.relatedEntityId },
    select: { id: true, status: true, userId: true, reviewItemIds: true },
  })

  if (!agentSession) {
    return NextResponse.json({ error: 'Linked agent session not found' }, { status: 404 })
  }

  if (agentSession.status !== 'AWAITING_REVIEW') {
    return NextResponse.json({
      sessionId: agentSession.id,
      status: agentSession.status,
      message: 'Session is not awaiting review',
    })
  }

  // Check if ALL linked review items are now resolved
  const linkedIds = agentSession.reviewItemIds
    ? (JSON.parse(agentSession.reviewItemIds) as string[])
    : []

  const unresolvedCount = linkedIds.length > 0
    ? await db.reviewItem.count({
        where: { id: { in: linkedIds }, status: { notIn: ['RESOLVED', 'DISMISSED'] } },
      })
    : 0

  const allCleared = unresolvedCount === 0

  await logAudit({
    actorUserId: authResult.user.id,
    actorEmail: authResult.user.email ?? undefined,
    tenantId: tenantContext.tenantId,
    action: 'agent.review_item_cleared',
    entityType: 'AgentSession',
    entityId: agentSession.id,
    details: {
      reviewItemId: body.reviewItemId,
      allCleared,
      remainingUnresolved: unresolvedCount,
      clearedBy: authResult.user.email,
    },
  })

  if (allCleared) {
    logger.info('All review items cleared for agent session — ready for resume', {
      sessionId: agentSession.id,
      userId: agentSession.userId,
      clearedBy: authResult.user.email,
    })
  }

  return NextResponse.json({
    sessionId: agentSession.id,
    allCleared,
    remainingUnresolved: unresolvedCount,
    readyForResume: allCleared,
  })
}
