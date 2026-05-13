import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { causalSummaryFromVc } from '@/lib/agents/causal-summary'
import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import type { VerifiableCredential } from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import {
  CausalEffectPdfError,
  renderCausalEffectPDF,
} from '@/lib/wallet/causal-effect-pdf'

interface PdfRequestBody {
  vc?: VerifiableCredential
  recipient?: string
  generatedAt?: string
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

  let body: PdfRequestBody
  try {
    body = (await request.json()) as PdfRequestBody
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

  let pdfBytes: Uint8Array
  try {
    pdfBytes = renderCausalEffectPDF({
      vc: body.vc,
      summary,
      recipient: body.recipient,
      generatedAt: body.generatedAt,
    })
  } catch (err) {
    if (err instanceof CausalEffectPdfError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    throw err
  }

  await logAudit({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    tenantId: tenantContext.tenantId,
    action: 'wallet.causal_effect_pdf_exported',
    entityType: 'CausalEffectEstimate',
    entityId: String(body.vc.id),
    details: {
      intervention: summary.intervention,
      outcome: summary.outcome,
      cohort_source: summary.cohort_source,
      low_evidence: summary.low_evidence,
      bytes: pdfBytes.byteLength,
    },
  })

  logger.info('Causal-effect PDF exported', {
    user_id: session.user.id,
    vc_id: body.vc.id,
    low_evidence: summary.low_evidence,
    bytes: pdfBytes.byteLength,
  })

  const payload = pdfBytes.slice(0, pdfBytes.byteLength)
  return new NextResponse(payload, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(pdfBytes.byteLength),
      'content-disposition': `attachment; filename="causal-effect-${String(body.vc.id).replace(/[^A-Za-z0-9_.-]+/g, '_')}.pdf"`,
      'x-causal-low-evidence': summary.low_evidence ? 'true' : 'false',
      'cache-control': 'private, no-store',
    },
  })
}
