/**
 * POST /api/wallet/digital-twin/policy
 *
 * JSON sibling of POST /api/wallet/digital-twin/pdf. Takes a
 * DigitalTwinForecastReceipt VC (and optionally a forecast) and returns the
 * derived TwinDisplayPolicy + a short list of UI hints (banner copy, badge
 * label). Wallet UIs use this to render the right disclosure chrome without
 * paying the cost of generating the PDF first.
 *
 * Body:
 *   {
 *     vc: VerifiableCredential,
 *     forecast?: { backend_used, trajectories }   // optional, takes precedence over the VC's embedded fields
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

import { getTwinDisplayPolicy } from '@/lib/agents/twin-display-policy'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { applyRateLimit } from '@/lib/rate-limit'
import type { SimulateResponse, VerifiableCredential } from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import { policyFromVc } from '@/lib/wallet/digital-twin-pdf'

interface PolicyRequestBody {
  vc?: VerifiableCredential
  forecast?: Pick<SimulateResponse, 'backend_used' | 'trajectories'>
}

const BANNER_BY_TIER: Record<string, string | null> = {
  illustrative: 'ILLUSTRATIVE - NOT CLINICAL GUIDANCE',
  'calibrated-partial':
    'CALIBRATED (PARTIAL) - some outcomes are low-confidence; review before clinical use',
  calibrated: null,
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

  const policy = body.forecast ? getTwinDisplayPolicy(body.forecast) : policyFromVc(body.vc)

  return NextResponse.json(
    {
      policy,
      ui: {
        banner: BANNER_BY_TIER[policy.tier] ?? null,
        badge: policy.badgeLabel,
      },
    },
    {
      headers: {
        'cache-control': 'private, no-store',
        'x-display-tier': policy.tier,
      },
    },
  )
}
