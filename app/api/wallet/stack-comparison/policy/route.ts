/**
 * POST /api/wallet/stack-comparison/policy
 *
 * JSON sibling of POST /api/wallet/stack-comparison/pdf. Takes a
 * CompareStacksResponse (and either an explicit `policy` or the
 * `backend_used` + `low_confidence_outcomes` needed to synthesise one) and
 * returns the cross-stack TwinDisplayPolicy plus matching UI hints (banner
 * copy + badge label). Wallet UIs use this to render the right disclosure
 * chrome for a comparison view without paying the cost of generating the
 * PDF first.
 *
 * Body:
 *   {
 *     comparison: CompareStacksResponse,
 *     policy?: TwinDisplayPolicy,           // explicit policy takes precedence
 *     backend_used?: MechanisticBackendUsed, // required if policy omitted
 *     low_confidence_outcomes?: string[]     // defaults to []
 *   }
 *
 * Response 200:
 *   {
 *     policy: TwinDisplayPolicy,
 *     ui: { banner: string | null, badge: string }
 *   }
 */

import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import type { TwinDisplayPolicy } from '@/lib/agents/twin-display-policy'
import { synthesiseDisplayPolicy } from '@/lib/agents/twin-display-policy'
import { twinDisplayUiHints } from '@/lib/agents/twin-display-ui'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { applyRateLimit } from '@/lib/rate-limit'
import type { CompareStacksResponse, MechanisticBackendUsed } from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

interface ComparePolicyRequestBody {
  comparison?: CompareStacksResponse
  policy?: TwinDisplayPolicy
  backend_used?: MechanisticBackendUsed
  low_confidence_outcomes?: string[]
}

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 60, windowMs: 60_000 })
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

  let body: ComparePolicyRequestBody
  try {
    body = (await request.json()) as ComparePolicyRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const comparison = body.comparison
  if (
    !comparison ||
    typeof comparison !== 'object' ||
    typeof comparison.simulation_id_a !== 'string' ||
    typeof comparison.simulation_id_b !== 'string' ||
    !comparison.delta_of_deltas ||
    typeof comparison.delta_of_deltas !== 'object'
  ) {
    return NextResponse.json(
      { error: 'comparison must include simulation_id_a, simulation_id_b and delta_of_deltas' },
      { status: 400 },
    )
  }

  let policy: TwinDisplayPolicy
  if (body.policy && body.policy.tier && body.policy.backendUsed) {
    policy = body.policy
  } else if (body.backend_used) {
    policy = synthesiseDisplayPolicy(body.backend_used, body.low_confidence_outcomes ?? [])
  } else {
    return NextResponse.json(
      { error: 'either `policy` or `backend_used` must be supplied' },
      { status: 400 },
    )
  }

  return NextResponse.json(
    {
      policy,
      ui: twinDisplayUiHints(policy),
    },
    {
      headers: {
        'cache-control': 'private, no-store',
        'x-display-tier': policy.tier,
      },
    },
  )
}
