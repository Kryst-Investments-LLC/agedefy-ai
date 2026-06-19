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
import { screeningSidecar, SidecarError, type DockingBox } from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

/**
 * POST /api/agents/chemistry/dock
 *
 * Runs AutoDock Vina docking via the screening-sidecar. The caller must supply:
 *  - A ligand SMILES (sidecar generates the 3D conformer)
 *  - A base64-encoded PDBQT receptor (pre-prepared by the caller offline)
 *  - An explicit docking box (center + size in Ångströms)
 *
 * Feature gate: ENABLE_SCREENING_SIDECAR=true (same sidecar as /screen).
 * Rate-limited to 3 req/min — docking takes 15–300 s depending on exhaustiveness.
 */

const boxVec = z.object({ x: z.number(), y: z.number(), z: z.number() })

const dockBodySchema = z.object({
  smiles: z.string().min(1, 'smiles is required').max(4000),
  receptor_pdbqt: z
    .string()
    .min(10, 'receptor_pdbqt must be a non-empty base64 PDBQT string')
    .max(5_000_000, 'receptor_pdbqt exceeds 5 MB limit'),
  box: z.object({
    center: boxVec,
    size: z.object({
      x: z.number().positive('box.size.x must be > 0'),
      y: z.number().positive('box.size.y must be > 0'),
      z: z.number().positive('box.size.z must be > 0'),
    }),
  }),
  exhaustiveness: z.number().int().min(1).max(32).optional(),
  n_poses: z.number().int().min(1).max(20).optional(),
})

export async function POST(request: NextRequest) {
  if (env.ENABLE_SCREENING_SIDECAR !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const blocked = await applyRateLimit(request, { maxRequests: 3, windowMs: 60_000 })
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

  const parsed = dockBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { smiles, receptor_pdbqt, box, exhaustiveness, n_poses } = parsed.data
  const traceparent = request.headers.get('traceparent') ?? undefined

  try {
    const result = await screeningSidecar.dock(
      { smiles, receptor_pdbqt, box: box as DockingBox, exhaustiveness, n_poses },
      traceparent,
    )

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      tenantId: tenantContext.tenantId,
      action: 'chemistry.smiles_docked',
      entityType: 'DockingResult',
      details: {
        binding_affinity_kcal_mol: result.binding_affinity_kcal_mol,
        exhaustiveness: result.exhaustiveness,
        n_poses_returned: result.n_poses_returned,
        model_version: result.model_version,
      },
    })

    logger.info('Docking completed', {
      userId: session.user.id,
      binding_affinity_kcal_mol: result.binding_affinity_kcal_mol,
    })

    const provenance = await signResultSafe({
      resultType: 'DockingResult',
      result: result as unknown as Record<string, unknown>,
      inputs: { smiles, exhaustiveness, n_poses },
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
    logger.error('Docking failed', { userId: session.user.id, error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
