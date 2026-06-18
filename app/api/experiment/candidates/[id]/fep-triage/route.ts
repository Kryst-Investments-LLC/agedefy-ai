import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { computeFepGateScore, type ScreenSummary, type DockSummary } from '@/lib/chemistry/fep-triage'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * POST /api/experiment/candidates/[id]/fep-triage
 *
 * Computes the FEP cost-triage gate score for a candidate and persists it.
 * Uses only cheap signals already on the candidate (Vina affinity from dockJson,
 * drug-likeness from screenJson, active-learning acquisitionScore) to decide
 * whether the candidate warrants an expensive Schrödinger FEP+ run.
 *
 * The researcher reads the result and decides whether to proceed with
 * POST /api/agents/chemistry/fep.  This endpoint never triggers a FEP job.
 *
 * Role gate: RESEARCHER or ADMIN
 * Idempotent: re-running recomputes and overwrites fepGateScore / fepGateReason.
 * No rate limit: pure CPU math, sub-millisecond, no sidecar involved.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = session.user.role as string | undefined
  if (role !== 'RESEARCHER' && role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden: FEP triage requires RESEARCHER or ADMIN role' },
      { status: 403 },
    )
  }

  const { id } = await params

  try {
    const candidate = await db.experimentCandidate.findFirst({
      where: { id, userId: session.user.id },
      select: {
        id: true,
        status: true,
        screenJson: true,
        dockJson: true,
        acquisitionScore: true,
        displayName: true,
      },
    })

    if (!candidate) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // ── Extract ScreenSummary from screenJson (ScreenResult shape) ──────────
    const rawScreen = candidate.screenJson as Record<string, unknown> | null
    const screen: ScreenSummary | null = rawScreen
      ? {
          valid: rawScreen.valid === true,
          qed: extractNumber(rawScreen, ['descriptors', 'qed']),
          lipinski_pass: extractBool(rawScreen, ['filters', 'lipinski', 'pass']),
          pains_pass: extractBool(rawScreen, ['filters', 'pains', 'pass']),
          herg_risk: extractBool(rawScreen, ['admet_flags', 'herg_liability_risk', 'flag']),
        }
      : null

    // ── Extract DockSummary from dockJson (DockResult shape) ────────────────
    const rawDock = candidate.dockJson as Record<string, unknown> | null
    const dock: DockSummary | null =
      rawDock && typeof rawDock.binding_affinity_kcal_mol === 'number'
        ? { binding_affinity_kcal_mol: rawDock.binding_affinity_kcal_mol }
        : null

    // ── Compute gate score (pure function, no I/O) ───────────────────────────
    const triage = computeFepGateScore({
      screen,
      dock,
      acquisitionScore: candidate.acquisitionScore,
    })

    // ── Persist ──────────────────────────────────────────────────────────────
    await db.experimentCandidate.update({
      where: { id },
      data: {
        fepGateScore: triage.score,
        fepGateReason: triage.reason,
      },
    })

    logger.info('FEP triage gate computed', {
      candidateId: id,
      userId: session.user.id,
      score: triage.score,
      recommend: triage.recommend,
    })

    return NextResponse.json(
      {
        candidateId: id,
        displayName: candidate.displayName,
        status: candidate.status,
        triage,
      },
      { status: 200 },
    )
  } catch (err) {
    logger.error('Failed to compute FEP triage gate', { error: err, id })
    return NextResponse.json({ error: 'Failed to compute FEP triage' }, { status: 500 })
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractNumber(obj: Record<string, unknown>, path: string[]): number | null {
  let cur: unknown = obj
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[key]
  }
  return typeof cur === 'number' ? cur : null
}

function extractBool(obj: Record<string, unknown>, path: string[]): boolean | null {
  let cur: unknown = obj
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[key]
  }
  return typeof cur === 'boolean' ? cur : null
}
