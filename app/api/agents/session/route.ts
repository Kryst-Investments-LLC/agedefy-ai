import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { applyRateLimit } from '@/lib/rate-limit'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { SupervisorAgent } from '@/lib/agents/supervisor'

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const consentBlocked = await requireGdprConsent(session.user.id, ['ai-health-info', 'data-processing'])
  if (consentBlocked) return consentBlocked

  const tenantContext = await deriveTenantContextWithValidation({
    sessionUser: session.user,
    request,
  })

  if (!tenantContext) {
    return NextResponse.json({ error: 'Invalid tenant context' }, { status: 403 })
  }

  try {
    const body: unknown = await request.json()

    if (
      !body ||
      typeof body !== 'object' ||
      !('goal' in body) ||
      typeof (body as { goal: unknown }).goal !== 'string'
    ) {
      return NextResponse.json({ error: 'Invalid request: goal is required' }, { status: 400 })
    }

    const goal = (body as { goal: string }).goal.trim()

    if (goal.length === 0) {
      return NextResponse.json({ error: 'Goal must not be empty' }, { status: 400 })
    }

    if (goal.length > 2000) {
      return NextResponse.json({ error: 'Goal must be at most 2000 characters' }, { status: 400 })
    }

    // Optional: pre-seed lab report text into the agent scratchpad
    const labReportText = 'labReportText' in body && typeof (body as { labReportText: unknown }).labReportText === 'string'
      ? ((body as { labReportText: string }).labReportText).slice(0, 500_000)
      : undefined

    const supervisor = new SupervisorAgent(session.user.id, tenantContext.tenantId)
    const result = await supervisor.run(goal, labReportText)

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      tenantId: tenantContext.tenantId,
      action: 'agent.session_created',
      entityType: 'AgentSession',
      entityId: result.sessionId,
      details: {
        goal,
        status: result.status,
        safetyFlagCount: result.safetyFlags.length,
      },
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    logger.error('Agent session failed', {
      userId: session.user.id,
      error: message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
