import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { getTwinDisplayPolicy } from '@/lib/agents/twin-display-policy'
import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import type { SimulateResponse, VerifiableCredential } from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import { renderDigitalTwinForecastPDF } from '@/lib/wallet/digital-twin-pdf'

interface PdfRequestBody {
  vc?: VerifiableCredential
  forecast?: Pick<SimulateResponse, 'backend_used' | 'trajectories'>
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
  if (!body.forecast || typeof body.forecast !== 'object') {
    return NextResponse.json({ error: 'forecast is required' }, { status: 400 })
  }

  const policy = getTwinDisplayPolicy(body.forecast)
  const pdfBytes = renderDigitalTwinForecastPDF({
    vc: body.vc,
    policy,
    recipient: body.recipient,
    generatedAt: body.generatedAt,
  })

  await logAudit({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    tenantId: tenantContext.tenantId,
    action: 'wallet.digital_twin_pdf_exported',
    entityType: 'DigitalTwinForecastReceipt',
    entityId: String(body.vc.id),
    details: {
      display_tier: policy.tier,
      backend_used: policy.backendUsed,
      low_confidence_outcomes: policy.lowConfidenceOutcomes,
      bytes: pdfBytes.byteLength,
    },
  })

  logger.info('Digital-twin PDF exported', {
    user_id: session.user.id,
    vc_id: body.vc.id,
    display_tier: policy.tier,
    bytes: pdfBytes.byteLength,
  })

  // Slice the Uint8Array's underlying ArrayBuffer to the exact view so the
  // BodyInit conversion doesn't include unrelated buffer bytes.
  const payload = pdfBytes.slice(0, pdfBytes.byteLength)
  return new NextResponse(payload, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(pdfBytes.byteLength),
      'content-disposition': `attachment; filename="digital-twin-forecast-${String(body.vc.id).replace(/[^A-Za-z0-9_.-]+/g, '_')}.pdf"`,
      'x-display-tier': policy.tier,
      'cache-control': 'private, no-store',
    },
  })
}
