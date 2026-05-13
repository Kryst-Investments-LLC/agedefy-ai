import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import {
  runDigitalTwinAgent,
  DigitalTwinValidationError,
  type DigitalTwinAgentInput,
  type DigitalTwinAgentOutput,
} from '@/lib/agents/digital-twin-agent'
import { signStackComparison } from '@/lib/agents/compare-stacks-vc'
import { getTwinDisplayPolicy, synthesiseDisplayPolicy } from '@/lib/agents/twin-display-policy'
import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import {
  mechanisticSidecar,
  SidecarError,
  type CompareStacksResponse,
} from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

interface CompareStacksRequestBody {
  baseline?: Record<string, number>
  stack_a?: DigitalTwinAgentInput['interventions']
  stack_b?: DigitalTwinAgentInput['interventions']
  outcomes?: string[]
  horizonWeeks?: number
  backend?: DigitalTwinAgentInput['backend']
  randomSeed?: number
  /** When true, request the mechanistic-sidecar v0.4.0 2-compartment PK/PD backend. */
  pkpdTwoCompartment?: boolean
  /** When true, also issue a signed DigitalTwinComparisonReceipt VC for the result. */
  sign?: boolean
  stackLabels?: { a: string; b: string }
}

function deltaOfDeltas(
  baseline: Record<string, number>,
  outcomes: string[],
  a: DigitalTwinAgentOutput,
  b: DigitalTwinAgentOutput,
): CompareStacksResponse['delta_of_deltas'] {
  const out: CompareStacksResponse['delta_of_deltas'] = {}
  for (const outcome of outcomes) {
    const trajA = a.trajectories[outcome]
    const trajB = b.trajectories[outcome]
    if (!trajA || !trajB) continue
    const aFinal = trajA.weekly_means[trajA.weekly_means.length - 1]
    const bFinal = trajB.weekly_means[trajB.weekly_means.length - 1]
    const base = baseline[outcome]
    const aDelta = typeof base === 'number' ? aFinal - base : aFinal
    const bDelta = typeof base === 'number' ? bFinal - base : bFinal
    const difference = bDelta - aDelta
    // Combine the two stacks' final-week CI half-widths conservatively (sum of
    // half-widths) — this is the same rule the contract uses when the sidecar
    // is unavailable and the Node-side fallback has to compute its own band.
    const aHalf = (trajA.ci95_high[trajA.ci95_high.length - 1] - trajA.ci95_low[trajA.ci95_low.length - 1]) / 2
    const bHalf = (trajB.ci95_high[trajB.ci95_high.length - 1] - trajB.ci95_low[trajB.ci95_low.length - 1]) / 2
    const half = aHalf + bHalf
    out[outcome] = {
      stack_a_final: aFinal,
      stack_b_final: bFinal,
      difference,
      ci95: [difference - half, difference + half],
    }
  }
  return out
}

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
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

  let body: CompareStacksRequestBody
  try {
    body = (await request.json()) as CompareStacksRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.baseline || typeof body.baseline !== 'object') {
    return NextResponse.json({ error: 'baseline is required' }, { status: 400 })
  }
  if (!Array.isArray(body.stack_a) || !Array.isArray(body.stack_b)) {
    return NextResponse.json(
      { error: 'stack_a and stack_b must each be arrays of interventions' },
      { status: 400 },
    )
  }
  if (!Array.isArray(body.outcomes) || body.outcomes.length === 0) {
    return NextResponse.json({ error: 'outcomes must be a non-empty array' }, { status: 400 })
  }

  const traceparent = request.headers.get('traceparent') ?? undefined
  const horizonWeeks = body.horizonWeeks
  const baseline = body.baseline
  const outcomes = body.outcomes

  try {
    // Sidecar path: a single round-trip when configured.
    if (mechanisticSidecar.configured()) {
      try {
        const resp = await mechanisticSidecar.compareStacks(
          {
            baseline,
            stack_a: body.stack_a,
            stack_b: body.stack_b,
            horizon_weeks: horizonWeeks ?? 260,
            outcomes,
            ...(body.pkpdTwoCompartment ? { pkpd_two_compartment: true } : {}),
          },
          traceparent,
        )
        const policy = synthesiseDisplayPolicy(
          (body.backend ?? 'hybrid') === 'statistical' ? 'statistical' : 'mechanistic',
          resp.low_confidence_outcomes ?? [],
        )
        let vc = null
        if (body.sign) {
          vc = await signStackComparison({
            userId: session.user.id,
            comparison: resp,
            policy,
            stackLabels: body.stackLabels,
            traceparent,
          })
        }
        await logAudit({
          actorUserId: session.user.id,
          actorEmail: session.user.email ?? undefined,
          tenantId: tenantContext.tenantId,
          action: 'agent.digital_twin_compared',
          entityType: 'DigitalTwinComparison',
          details: {
            backend: 'sidecar',
            simulation_id_a: resp.simulation_id_a,
            simulation_id_b: resp.simulation_id_b,
            outcomes,
            display_tier: policy.tier,
            signed: Boolean(vc),
          },
        })
        return NextResponse.json({
          ...resp,
          policy,
          vc,
        })
      } catch (err) {
        // 5xx falls through to the Node-side fallback; 4xx propagates.
        if (!(err instanceof SidecarError) || err.status < 500) throw err
        logger.warn('mechanistic-sidecar compare-stacks degraded to fallback', {
          status: (err as SidecarError).status,
        })
      }
    }

    // Fallback: run the in-process simulator twice and compute delta-of-deltas.
    const common = {
      baseline,
      outcomes,
      horizonWeeks,
      backend: body.backend,
      randomSeed: body.randomSeed,
      pkpdTwoCompartment: body.pkpdTwoCompartment,
      traceparent,
    } as const

    const [a, b] = await Promise.all([
      runDigitalTwinAgent({ ...common, interventions: body.stack_a }),
      runDigitalTwinAgent({ ...common, interventions: body.stack_b }),
    ])

    const delta = deltaOfDeltas(baseline, outcomes, a, b)
    const policyA = getTwinDisplayPolicy(a)
    const policyB = getTwinDisplayPolicy(b)
    // Union the two stacks' low-confidence outcomes — the comparison is
    // only as strong as the weaker side per outcome.
    const mergedLowConfidence = Array.from(
      new Set([...policyA.lowConfidenceOutcomes, ...policyB.lowConfidenceOutcomes]),
    )
    // The pair is illustrative if either side is.
    const backendUsed =
      policyA.tier === 'illustrative' || policyB.tier === 'illustrative'
        ? 'fallback-exponential'
        : a.backend_used
    const policy = synthesiseDisplayPolicy(backendUsed, mergedLowConfidence)

    const comparison: CompareStacksResponse = {
      simulation_id_a: a.simulation_id,
      simulation_id_b: b.simulation_id,
      delta_of_deltas: delta,
      backend_used: a.backend_used,
      low_confidence_outcomes: mergedLowConfidence,
    }

    let vc = null
    if (body.sign) {
      vc = await signStackComparison({
        userId: session.user.id,
        comparison,
        policy,
        stackLabels: body.stackLabels,
        traceparent,
      })
    }

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      tenantId: tenantContext.tenantId,
      action: 'agent.digital_twin_compared',
      entityType: 'DigitalTwinComparison',
      details: {
        backend: 'fallback',
        simulation_id_a: a.simulation_id,
        simulation_id_b: b.simulation_id,
        outcomes,
        display_tier: policy.tier,
        low_confidence_outcomes: policy.lowConfidenceOutcomes,
        signed: Boolean(vc),
      },
    })

    return NextResponse.json({
      ...comparison,
      policy,
      vc,
    })
  } catch (err) {
    if (err instanceof DigitalTwinValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 })
    }
    if (err instanceof SidecarError) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return NextResponse.json({ error: err.message, body: err.body }, { status })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    logger.error('Digital-twin compare-stacks failed', {
      userId: session.user.id,
      error: message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
