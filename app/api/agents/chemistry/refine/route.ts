import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { openmmSidecar, SidecarError } from '@/lib/sidecars'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

/**
 * POST /api/agents/chemistry/refine
 *
 * Runs OpenMM energy minimisation and optional MD refinement on a docked pose
 * via the openmm-sidecar.  Returns MM-GBSA binding energy, pose RMSD, and a
 * composite md_ranking_score (0–1) for downstream candidate ranking.
 *
 * Feature gate: ENABLE_OPENMM_SIDECAR=true
 * Rate-limited to 2 req/min — minimize mode takes ~30 s; md mode up to 30 min.
 * Timeout: 1800 s (30 min) to accommodate long MD productions.
 */

const forceFieldSchema = z
  .object({
    protein: z.enum(['amber14-all', 'charmm36m']).optional(),
    small_molecule: z.enum(['openff-2.0.0', 'openff-1.3.1', 'mmff94']).optional(),
    water: z.enum(['tip3p', 'tip3pfb']).optional(),
  })
  .optional()

const simulationSchema = z
  .object({
    minimization_steps: z.number().int().min(100).max(100_000).optional(),
    equilibration_ps: z.number().min(0).max(1000).optional(),
    production_ps: z.number().min(0).max(2000).optional(),
    temperature_K: z.number().min(200).max(400).optional(),
    pressure_bar: z.number().min(0.5).max(2.0).optional(),
  })
  .optional()

const rankingWeightsSchema = z
  .object({
    mmgbsa: z.number().min(0).max(1).optional(),
    rmsd_penalty: z.number().min(0).max(1).optional(),
  })
  .optional()

const refineBodySchema = z.object({
  smiles: z.string().min(1, 'smiles is required').max(4000),
  receptor: z
    .string()
    .min(10, 'receptor must be a non-empty base64 string')
    .max(5_000_000, 'receptor exceeds 5 MB limit'),
  receptor_format: z.enum(['pdb', 'pdbqt']).optional(),
  docked_pose_pdbqt: z
    .string()
    .min(10, 'docked_pose_pdbqt must be a non-empty base64 PDBQT string')
    .max(500_000, 'docked_pose_pdbqt exceeds 500 kB limit'),
  force_field: forceFieldSchema,
  simulation: simulationSchema,
  refine_mode: z.enum(['minimize', 'md']).optional(),
  compute_mmgbsa: z.boolean().optional(),
  ranking_weights: rankingWeightsSchema,
})

export async function POST(request: NextRequest) {
  if (env.ENABLE_OPENMM_SIDECAR !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const blocked = await applyRateLimit(request, { maxRequests: 2, windowMs: 60_000 })
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

  const parsed = refineBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const {
    smiles,
    receptor,
    receptor_format,
    docked_pose_pdbqt,
    force_field,
    simulation,
    refine_mode,
    compute_mmgbsa,
    ranking_weights,
  } = parsed.data
  const traceparent = request.headers.get('traceparent') ?? undefined

  try {
    const result = await openmmSidecar.refine(
      {
        smiles,
        receptor,
        receptor_format,
        docked_pose_pdbqt,
        force_field,
        simulation,
        refine_mode,
        compute_mmgbsa,
        ranking_weights,
      },
      traceparent,
    )

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      tenantId: tenantContext.tenantId,
      action: 'chemistry.md_refinement_run',
      entityType: 'RefineResult',
      details: {
        refine_mode: result.refine_mode,
        mmgbsa_binding_energy_kcal_mol: result.mmgbsa_binding_energy_kcal_mol,
        pose_rmsd_angstrom: result.pose_rmsd_angstrom,
        md_ranking_score: result.md_ranking_score,
        convergence_flag: result.convergence_flag,
        model_version: result.model_version,
      },
    })

    logger.info('MD refinement completed', {
      userId: session.user.id,
      refine_mode: result.refine_mode,
      mmgbsa_binding_energy_kcal_mol: result.mmgbsa_binding_energy_kcal_mol,
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof SidecarError) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return NextResponse.json({ error: err.message, body: err.body }, { status })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    logger.error('MD refinement failed', { userId: session.user.id, error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
