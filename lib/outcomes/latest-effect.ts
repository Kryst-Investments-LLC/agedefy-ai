/**
 * Latest measured protocol effect — the closed-loop payoff.
 *
 * Reads the most recent ProtocolOutcome (written by lib/loop/outcome-writer when
 * a loop cycle completes) and returns the observed biomarker deltas in a clean
 * UI shape. This is the real causal readout that lights the "See effect" stage.
 */

import { db } from '@/lib/db'

export interface ObservedEffect {
  name: string
  observedDelta: number
  observedDirection: 'up' | 'down' | 'stable'
  confidence: number
}

export interface LatestEffect {
  protocolName: string | null
  cycleStartDate: string
  cycleEndDate: string | null
  overallEfficacy: number | null
  twinPredictionAccuracy: number | null
  observed: ObservedEffect[]
}

export async function getLatestProtocolEffect(userId: string): Promise<LatestEffect | null> {
  const outcome = await db.protocolOutcome.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      cycleStartDate: true,
      cycleEndDate: true,
      overallEfficacy: true,
      twinPredictionAccuracy: true,
      observedBiomarkers: true,
      protocol: { select: { name: true } },
    },
  })
  if (!outcome) return null

  const raw = Array.isArray(outcome.observedBiomarkers)
    ? (outcome.observedBiomarkers as unknown as ObservedEffect[])
    : []
  const observed = raw.filter(
    (o): o is ObservedEffect => !!o && typeof o.name === 'string' && typeof o.observedDelta === 'number',
  )

  return {
    protocolName: outcome.protocol?.name ?? null,
    cycleStartDate: outcome.cycleStartDate.toISOString(),
    cycleEndDate: outcome.cycleEndDate?.toISOString() ?? null,
    overallEfficacy: outcome.overallEfficacy,
    twinPredictionAccuracy: outcome.twinPredictionAccuracy,
    observed,
  }
}
