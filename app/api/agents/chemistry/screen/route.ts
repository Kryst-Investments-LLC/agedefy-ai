import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { signResultSafe } from '@/lib/provenance/sign-result'
import { screeningSidecar, SidecarError } from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

/**
 * POST /api/agents/chemistry/screen
 *
 * Given a SMILES string, returns RDKit descriptors, validity checks,
 * drug-likeness filters (Lipinski/Veber/Ghose/lead-like/PAINS), and
 * rule-based ADMET flags via the screening-sidecar.
 *
 * Feature gate: ENABLE_SCREENING_SIDECAR=true (default OFF).
 */

const screenBodySchema = z.object({
  smiles: z.string().min(1, 'smiles is required').max(4000),
  include_pains: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  if (env.ENABLE_SCREENING_SIDECAR !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const consentBlocked = await requireGdprConsent(session.user.id, ['data-processing'])
  if (consentBlocked) return consentBlocked

  const tenantContext = await deriveTenantContextWithValidation({
    sessionUser: session.user,
    request,
  })
  if (!tenantContext) {
    return NextResponse.json({ error: 'Invalid tenant context' }, { status: 403 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = screenBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { smiles, include_pains } = parsed.data
  const traceparent = request.headers.get('traceparent') ?? undefined

  try {
    const result = await screeningSidecar.screen({ smiles, include_pains }, traceparent)

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      tenantId: tenantContext.tenantId,
      action: 'chemistry.smiles_screened',
      entityType: 'ScreeningResult',
      details: {
        valid: result.valid,
        lipinski_pass: result.filters?.lipinski?.pass ?? null,
        qed: result.descriptors?.qed ?? null,
        model_version: result.model_version,
      },
    })

    logger.info('SMILES screening completed', {
      userId: session.user.id,
      valid: result.valid,
    })

    const provenance = await signResultSafe({
      resultType: 'ScreeningResult',
      result: result as unknown as Record<string, unknown>,
      inputs: { smiles, include_pains },
      modelVersion: result.model_version,
      validationStatus: 'computational_estimate',
      traceparent,
    })

    return NextResponse.json({ ...result, provenance })
  } catch (err) {
    if (err instanceof SidecarError) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return NextResponse.json({ error: err.message, body: err.body }, { status })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    logger.error('SMILES screening failed', { userId: session.user.id, error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
