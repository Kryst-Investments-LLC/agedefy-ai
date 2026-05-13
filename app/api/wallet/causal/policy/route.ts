/**
 * POST /api/wallet/causal/policy
 *
 * Authenticated, tenant-scoped sibling of the public verify endpoint's
 * `causal_summary` field. Takes a `CausalEffectEstimate` VC and returns the
 * derived `CausalSummary` (intervention/outcome/effect/ci/cohort, plus the
 * pre-rendered `effect_label` and `evidence_label`).
 *
 * Wallet UIs use this when the user is logged in and just wants the summary
 * for their own VC without going through the public verify path (which also
 * runs cryptographic verification + revocation checks).
 *
 * Body:
 *   { vc: VerifiableCredential }
 *
 * Response 200:
 *   { summary: CausalSummary }
 *
 * Response 422 when the VC is not a CausalEffectEstimate or its payload is
 * missing required fields (intervention, outcome, expected_delta, ci95).
 */

import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { causalSummaryFromVc } from '@/lib/agents/causal-summary'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { applyRateLimit } from '@/lib/rate-limit'
import type { VerifiableCredential } from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

interface PolicyRequestBody {
  vc?: VerifiableCredential
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

  let body: PolicyRequestBody
  try {
    body = (await request.json()) as PolicyRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.vc || typeof body.vc !== 'object' || !body.vc.id) {
    return NextResponse.json({ error: 'vc is required and must include an id' }, { status: 400 })
  }

  const summary = causalSummaryFromVc(body.vc)
  if (!summary) {
    return NextResponse.json(
      {
        error:
          'vc is not a CausalEffectEstimate or its payload is missing intervention/outcome/expected_delta/ci95',
        code: 'not_causal_effect_estimate',
      },
      { status: 422 },
    )
  }

  return NextResponse.json(
    { summary },
    {
      headers: {
        'cache-control': 'private, no-store',
        'x-causal-low-evidence': summary.low_evidence ? 'true' : 'false',
      },
    },
  )
}
