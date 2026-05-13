import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import {
  DigitalTwinValidationError,
  type DigitalTwinAgentInput,
} from '@/lib/agents/digital-twin-agent'
import { runAndSignDigitalTwinAgent } from '@/lib/agents/digital-twin-vc'
import { getTwinDisplayPolicy } from '@/lib/agents/twin-display-policy'
import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { SidecarError } from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

interface SimulateRequestBody {
  baseline?: Record<string, number>
  interventions?: DigitalTwinAgentInput['interventions']
  outcomes?: string[]
  horizonWeeks?: number
  backend?: DigitalTwinAgentInput['backend']
  randomSeed?: number
  /** Opt into mechanistic-sidecar v0.4.0 2-compartment PK/PD backend. */
  pkpdTwoCompartment?: boolean
  /** Skip signing and return only the raw forecast (cheaper for previews). */
  skipSigning?: boolean
}

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const consentBlocked = await requireGdprConsent(session.user.id, [
    'ai-health-info',
    'data-processing',
  ])
  if (consentBlocked) return consentBlocked

  const tenantContext = await deriveTenantContextWithValidation({
    sessionUser: session.user,
    request,
  })
  if (!tenantContext) {
    return NextResponse.json({ error: 'Invalid tenant context' }, { status: 403 })
  }

  let body: SimulateRequestBody
  try {
    body = (await request.json()) as SimulateRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.baseline || typeof body.baseline !== 'object') {
    return NextResponse.json({ error: 'baseline is required' }, { status: 400 })
  }
  if (!Array.isArray(body.interventions)) {
    return NextResponse.json({ error: 'interventions must be an array' }, { status: 400 })
  }
  if (!Array.isArray(body.outcomes) || body.outcomes.length === 0) {
    return NextResponse.json({ error: 'outcomes must be a non-empty array' }, { status: 400 })
  }

  const traceparent = request.headers.get('traceparent') ?? undefined

  try {
    const skipSigning = Boolean(body.skipSigning)

    const agentInput: DigitalTwinAgentInput = {
      baseline: body.baseline,
      interventions: body.interventions,
      outcomes: body.outcomes,
      horizonWeeks: body.horizonWeeks,
      backend: body.backend,
      randomSeed: body.randomSeed,
      pkpdTwoCompartment: body.pkpdTwoCompartment,
      traceparent,
    }

    let forecast
    let vc = null
    if (skipSigning) {
      const { runDigitalTwinAgent } = await import('@/lib/agents/digital-twin-agent')
      forecast = await runDigitalTwinAgent(agentInput)
    } else {
      const result = await runAndSignDigitalTwinAgent({
        ...agentInput,
        userId: session.user.id,
      })
      forecast = result.forecast
      vc = result.vc
    }

    const policy = getTwinDisplayPolicy(forecast)

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      tenantId: tenantContext.tenantId,
      action: 'agent.digital_twin_simulated',
      entityType: 'DigitalTwinSimulation',
      entityId: forecast.simulation_id,
      details: {
        backend_used: forecast.backend_used,
        model_version: forecast.model_version,
        horizon_weeks: forecast.horizon_weeks,
        outcomes: body.outcomes,
        intervention_count: body.interventions.length,
        fallback_used: forecast.fallbackUsed,
        display_tier: policy.tier,
        low_confidence_outcomes: policy.lowConfidenceOutcomes,
        signed: !skipSigning,
      },
    })

    logger.info('Digital-twin simulation completed', {
      userId: session.user.id,
      simulation_id: forecast.simulation_id,
      backend_used: forecast.backend_used,
      display_tier: policy.tier,
    })

    return NextResponse.json({ forecast, vc, policy })
  } catch (err) {
    if (err instanceof DigitalTwinValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 })
    }
    if (err instanceof SidecarError) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return NextResponse.json({ error: err.message, body: err.body }, { status })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    logger.error('Digital-twin simulation failed', {
      userId: session.user.id,
      error: message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
