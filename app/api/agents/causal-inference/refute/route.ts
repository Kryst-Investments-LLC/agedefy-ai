import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import {
  causalSidecar,
  SidecarError,
  type CausalRefuter,
} from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

/**
 * POST /api/agents/causal-inference/refute
 *
 * Thin HTTP surface over the causal-sidecar's /v1/refute endpoint. Lets
 * clients re-validate an existing estimate (by `estimate_id`) under one of
 * three sensitivity perturbations: placebo treatment, random common cause,
 * or data-subset refuter.
 *
 * Parity with the other agent routes: NextAuth + GDPR consent + tenant +
 * rate-limit + audit log. The audit row records the refuter and the
 * pass/fail outcome so reviewers can spot estimates that fail to refute.
 */

interface RefuteRequestBody {
  estimate_id?: string
  refuter?: CausalRefuter
}

const ALLOWED_REFUTERS: ReadonlyArray<CausalRefuter> = [
  'placebo_treatment',
  'random_common_cause',
  'data_subset_refuter',
]

export async function POST(request: NextRequest) {
  // Feature flag gate — ENABLE_CAUSAL_SIDECAR defaults OFF
  if (env.ENABLE_CAUSAL_SIDECAR !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

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

  let body: RefuteRequestBody
  try {
    body = (await request.json()) as RefuteRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.estimate_id || typeof body.estimate_id !== 'string') {
    return NextResponse.json({ error: 'estimate_id is required' }, { status: 400 })
  }
  if (!body.refuter || !ALLOWED_REFUTERS.includes(body.refuter)) {
    return NextResponse.json(
      {
        error:
          'refuter must be one of placebo_treatment, random_common_cause, data_subset_refuter',
      },
      { status: 400 },
    )
  }

  const traceparent = request.headers.get('traceparent') ?? undefined

  try {
    const result = await causalSidecar.refute(
      { estimate_id: body.estimate_id, refuter: body.refuter },
      traceparent,
    )

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      tenantId: tenantContext.tenantId,
      action: 'agent.causal_effect_refuted',
      entityType: 'CausalEffectEstimate',
      entityId: body.estimate_id,
      details: {
        refuter: body.refuter,
        passed: result.passed,
        refuted_estimate: result.refuted_estimate,
        p_value: result.p_value,
      },
    })

    logger.info('Causal-inference refute completed', {
      userId: session.user.id,
      estimate_id: body.estimate_id,
      refuter: body.refuter,
      passed: result.passed,
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof SidecarError) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return NextResponse.json({ error: err.message, body: err.body }, { status })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    logger.error('Causal-inference refute failed', {
      userId: session.user.id,
      error: message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
