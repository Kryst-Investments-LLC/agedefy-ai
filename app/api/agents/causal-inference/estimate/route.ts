import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import {
  runCausalInferenceAgent,
  type CausalInferenceAgentInput,
} from '@/lib/agents/causal-inference-agent'
import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { SidecarError } from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

/**
 * POST /api/agents/causal-inference/estimate
 *
 * Thin HTTP surface over `runCausalInferenceAgent` (which delegates to the
 * causal-sidecar's /v1/estimate). Parity with the digital-twin routes:
 * NextAuth + GDPR consent + per-tenant context + rate-limit + audit log.
 *
 * When `sign: true`, the response includes a CausalEffectEstimate VC signed
 * by the platform vc-signer; otherwise only the raw estimate is returned.
 */

interface EstimateRequestBody {
  exposure?: string
  outcome?: string
  cohort?: CausalInferenceAgentInput['cohort']
  covariates?: string[]
  estimator?: CausalInferenceAgentInput['estimator']
  n_bootstrap?: number
  user_profile_hash?: string
  /** When true, also issue a signed CausalEffectEstimate VC. */
  sign?: boolean
}

const ALLOWED_COHORTS: ReadonlyArray<CausalInferenceAgentInput['cohort']> = [
  'uk_biobank',
  'all_of_us',
  'agedefy_federated_v1',
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

  let body: EstimateRequestBody
  try {
    body = (await request.json()) as EstimateRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.exposure || typeof body.exposure !== 'string') {
    return NextResponse.json({ error: 'exposure is required' }, { status: 400 })
  }
  if (!body.outcome || typeof body.outcome !== 'string') {
    return NextResponse.json({ error: 'outcome is required' }, { status: 400 })
  }
  if (!body.cohort || !ALLOWED_COHORTS.includes(body.cohort)) {
    return NextResponse.json(
      { error: 'cohort must be one of uk_biobank, all_of_us, agedefy_federated_v1' },
      { status: 400 },
    )
  }

  const traceparent = request.headers.get('traceparent') ?? undefined

  try {
    const result = await runCausalInferenceAgent({
      exposure: body.exposure,
      outcome: body.outcome,
      cohort: body.cohort,
      covariates: body.covariates,
      estimator: body.estimator,
      n_bootstrap: body.n_bootstrap,
      user_profile_hash: body.user_profile_hash,
      traceparent,
      signWith: body.sign ? { userId: session.user.id } : undefined,
    })

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      tenantId: tenantContext.tenantId,
      action: 'agent.causal_effect_estimated',
      entityType: 'CausalEffectEstimate',
      details: {
        exposure: body.exposure,
        outcome: body.outcome,
        cohort: body.cohort,
        estimator: body.estimator ?? 'backdoor.linear_regression',
        identification_strategy: result.identification_strategy,
        model_version: result.model_version,
        signed: Boolean(result.vc),
      },
    })

    logger.info('Causal-inference estimate completed', {
      userId: session.user.id,
      exposure: body.exposure,
      outcome: body.outcome,
      cohort: body.cohort,
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof SidecarError) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return NextResponse.json({ error: err.message, body: err.body }, { status })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    logger.error('Causal-inference estimate failed', {
      userId: session.user.id,
      error: message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
