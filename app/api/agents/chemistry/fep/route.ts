import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { fepSidecar, SidecarError } from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

/**
 * POST /api/agents/chemistry/fep
 *
 * Submits a relative binding free-energy perturbation (ΔΔG) calculation via
 * the fep-sidecar, which wraps Schrödinger FEP+.  The caller provides:
 *   - smiles_reference: anchor ligand in the perturbation
 *   - smiles_candidate: ligand under evaluation
 *   - receptor_pdb: base64-encoded all-atom prepared PDB receptor
 *   - docked_pose_pdbqt: best Vina pose for smiles_candidate (from /v1/dock)
 *
 * The sidecar owns ligand/receptor preparation, FEP+ job submission, GPU
 * polling, and result extraction.  A single relative edge takes 30–90 min
 * on GPU; the endpoint timeout is set to 2 hours.
 *
 * Feature gate: ENABLE_FEP_SIDECAR=true
 * Role gate:    RESEARCHER or ADMIN  (FEP is researcher-tier, not consumer)
 * Rate limit:   1 req/min  — prevents queue saturation on GPU resources
 * Consent:      data-processing
 */

const fepBodySchema = z.object({
  smiles_reference: z
    .string()
    .min(1, 'smiles_reference is required')
    .max(4000, 'smiles_reference exceeds 4000 character limit'),
  smiles_candidate: z
    .string()
    .min(1, 'smiles_candidate is required')
    .max(4000, 'smiles_candidate exceeds 4000 character limit'),
  receptor_pdb: z
    .string()
    .min(10, 'receptor_pdb must be a non-empty base64 PDB string')
    .max(10_000_000, 'receptor_pdb exceeds 10 MB limit'),
  docked_pose_pdbqt: z
    .string()
    .min(10, 'docked_pose_pdbqt must be a non-empty base64 PDBQT string')
    .max(500_000, 'docked_pose_pdbqt exceeds 500 kB limit'),
  lambda_windows: z.number().int().min(8).max(24).optional(),
  sampling_ns_per_window: z.number().min(1).max(20).optional(),
  temperature_K: z.number().min(270).max(320).optional(),
})

export async function POST(request: NextRequest) {
  if (env.ENABLE_FEP_SIDECAR !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const blocked = await applyRateLimit(request, { maxRequests: 1, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = session.user.role as string | undefined
  if (role !== 'RESEARCHER' && role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden: FEP calculations require RESEARCHER or ADMIN role' },
      { status: 403 },
    )
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

  const parsed = fepBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const {
    smiles_reference,
    smiles_candidate,
    receptor_pdb,
    docked_pose_pdbqt,
    lambda_windows,
    sampling_ns_per_window,
    temperature_K,
  } = parsed.data
  const traceparent = request.headers.get('traceparent') ?? undefined

  try {
    const result = await fepSidecar.perturb(
      {
        smiles_reference,
        smiles_candidate,
        receptor_pdb,
        docked_pose_pdbqt,
        lambda_windows,
        sampling_ns_per_window,
        temperature_K,
      },
      traceparent,
    )

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      tenantId: tenantContext.tenantId,
      action: 'chemistry.fep_perturbation_run',
      entityType: 'FepResult',
      details: {
        ddg_kcal_mol: result.ddg_kcal_mol,
        ddg_sem_kcal_mol: result.ddg_sem_kcal_mol,
        convergence_flag: result.convergence_flag,
        hysteresis_kcal_mol: result.hysteresis_kcal_mol,
        lambda_windows_used: result.lambda_windows_used,
        sampling_ns_per_window: result.sampling_ns_per_window,
        backend_used: result.backend_used,
        schrodinger_job_id: result.schrodinger_job_id,
        model_version: result.model_version,
      },
    })

    logger.info('FEP perturbation completed', {
      userId: session.user.id,
      ddg_kcal_mol: result.ddg_kcal_mol,
      convergence_flag: result.convergence_flag,
      backend_used: result.backend_used,
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof SidecarError) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return NextResponse.json({ error: err.message, body: err.body }, { status })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    logger.error('FEP perturbation failed', { userId: session.user.id, error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
