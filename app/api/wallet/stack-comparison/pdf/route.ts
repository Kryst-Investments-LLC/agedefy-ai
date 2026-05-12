import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import type { TwinDisplayPolicy } from '@/lib/agents/twin-display-policy'
import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import type { CompareStacksResponse, MechanisticBackendUsed } from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import { renderStackComparisonPDF } from '@/lib/wallet/stack-comparison-pdf'

interface ComparePdfRequestBody {
  comparison?: CompareStacksResponse
  /** Optional explicit policy. When omitted the route synthesises one from `backend_used`. */
  policy?: TwinDisplayPolicy
  /** Required when `policy` is omitted: the backend tag that produced the comparison. */
  backend_used?: MechanisticBackendUsed
  /** Optional list of outcome ids that came back low-confidence (when known). */
  low_confidence_outcomes?: string[]
  title?: string
  recipient?: string
  generatedAt?: string
  stackLabels?: { a: string; b: string }
}

function synthesisePolicy(
  backendUsed: MechanisticBackendUsed,
  lowConfidenceOutcomes: string[],
): TwinDisplayPolicy {
  // Mirror getTwinDisplayPolicy without requiring trajectory data.
  if (backendUsed === 'fallback-exponential') {
    return {
      tier: 'illustrative',
      backendUsed,
      isIllustrative: true,
      requiresClinicianBanner: true,
      lowConfidenceOutcomes,
      badgeLabel: 'Illustrative - not clinical',
      badgeTooltip:
        'Comparison produced by the in-process fallback simulator. Do not present as clinical.',
    }
  }
  if (lowConfidenceOutcomes.length > 0) {
    return {
      tier: 'calibrated-partial',
      backendUsed,
      isIllustrative: false,
      requiresClinicianBanner: true,
      lowConfidenceOutcomes,
      badgeLabel: `Calibrated - ${lowConfidenceOutcomes.length} outcome${
        lowConfidenceOutcomes.length === 1 ? '' : 's'
      } low-confidence`,
      badgeTooltip: `Backend: ${backendUsed}. Some outcomes were flagged low-confidence: ${lowConfidenceOutcomes.join(', ')}.`,
    }
  }
  return {
    tier: 'calibrated',
    backendUsed,
    isIllustrative: false,
    requiresClinicianBanner: false,
    lowConfidenceOutcomes: [],
    badgeLabel: 'Calibrated',
    badgeTooltip: `Backend: ${backendUsed}. Full-confidence comparison.`,
  }
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

  let body: ComparePdfRequestBody
  try {
    body = (await request.json()) as ComparePdfRequestBody
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
    policy = synthesisePolicy(body.backend_used, body.low_confidence_outcomes ?? [])
  } else {
    return NextResponse.json(
      { error: 'either `policy` or `backend_used` must be supplied' },
      { status: 400 },
    )
  }

  const pdfBytes = renderStackComparisonPDF({
    title: body.title,
    comparison,
    policy,
    recipient: body.recipient,
    generatedAt: body.generatedAt,
    stackLabels: body.stackLabels,
  })

  await logAudit({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    tenantId: tenantContext.tenantId,
    action: 'wallet.stack_comparison_pdf_exported',
    entityType: 'DigitalTwinComparison',
    details: {
      simulation_id_a: comparison.simulation_id_a,
      simulation_id_b: comparison.simulation_id_b,
      display_tier: policy.tier,
      backend_used: policy.backendUsed,
      low_confidence_outcomes: policy.lowConfidenceOutcomes,
      bytes: pdfBytes.byteLength,
    },
  })

  logger.info('Stack comparison PDF exported', {
    user_id: session.user.id,
    simulation_id_a: comparison.simulation_id_a,
    simulation_id_b: comparison.simulation_id_b,
    display_tier: policy.tier,
    bytes: pdfBytes.byteLength,
  })

  const payload = pdfBytes.slice(0, pdfBytes.byteLength)
  const filename =
    `stack-comparison-${comparison.simulation_id_a}-${comparison.simulation_id_b}.pdf`.replace(
      /[^A-Za-z0-9_.-]+/g,
      '_',
    )
  const finalName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  return new NextResponse(payload, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(pdfBytes.byteLength),
      'content-disposition': `attachment; filename="${finalName}"`,
      'x-display-tier': policy.tier,
      'cache-control': 'private, no-store',
    },
  })
}
