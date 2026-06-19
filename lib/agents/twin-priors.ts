/**
 * Per-user Bayesian prior store for the digital twin fallback simulator.
 *
 * The fallback simulator in `digital-twin-agent.ts` uses hard-coded
 * `FALLBACK_EFFECTS` (population-average literature estimates). This module
 * layers personalisation on top: after each reflection cycle, the observed
 * biomarker response updates the user's prior via a simple Bayesian update.
 *
 * Priors are bounded to ±50% of the population default to prevent runaway
 * personalisation from a single outlier observation.
 */

import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

export interface FallbackEffect {
  targetDeltaPct: number
  halfLifeWeeks: number
}

export interface PriorAdjustment {
  compoundId: string
  outcomeKey: string
  /** Observed delta as a fraction of baseline (e.g. -0.12 = 12% decrease). */
  observedDeltaPct: number
  /** Suggested new targetDeltaPct. Computed by the reflection agent. */
  recommendedPriorAdjustment: number
}

// Population defaults — mirrors FALLBACK_EFFECTS in digital-twin-agent.ts.
// Used as the seed value when no UserTwinPrior row exists yet.
const POPULATION_DEFAULTS: Record<string, Record<string, FallbackEffect>> = {
  rapamycin: {
    hs_crp: { targetDeltaPct: -0.25, halfLifeWeeks: 8 },
    hba1c: { targetDeltaPct: -0.05, halfLifeWeeks: 12 },
    apob: { targetDeltaPct: -0.08, halfLifeWeeks: 10 },
  },
  metformin: {
    hba1c: { targetDeltaPct: -0.1, halfLifeWeeks: 6 },
    glucose: { targetDeltaPct: -0.12, halfLifeWeeks: 4 },
    hs_crp: { targetDeltaPct: -0.08, halfLifeWeeks: 12 },
  },
  nmn: {
    nad_plus: { targetDeltaPct: 0.4, halfLifeWeeks: 4 },
    hrv: { targetDeltaPct: 0.05, halfLifeWeeks: 12 },
  },
  statin: {
    ldl: { targetDeltaPct: -0.4, halfLifeWeeks: 4 },
    apob: { targetDeltaPct: -0.3, halfLifeWeeks: 6 },
    total_cholesterol: { targetDeltaPct: -0.25, halfLifeWeeks: 4 },
  },
  berberine: {
    hba1c: { targetDeltaPct: -0.07, halfLifeWeeks: 8 },
    ldl: { targetDeltaPct: -0.1, halfLifeWeeks: 8 },
  },
}

function populationDefault(compoundId: string, outcomeKey: string): FallbackEffect | undefined {
  const key = compoundId.toLowerCase().split("_")[0]
  return POPULATION_DEFAULTS[key]?.[outcomeKey.toLowerCase()]
}

/**
 * Returns the effect priors for every outcome key for a given compound,
 * merged with any per-user adjustments stored in `UserTwinPrior`.
 *
 * Falls back to POPULATION_DEFAULTS when no user-specific row exists.
 * Never throws.
 */
export async function getEffectPriors(
  userId: string | undefined,
  compoundId: string,
): Promise<Record<string, FallbackEffect>> {
  const populationMap = POPULATION_DEFAULTS[compoundId.toLowerCase().split("_")[0]] ?? {}
  if (!userId) return populationMap

  try {
    const userPriors = await db.userTwinPrior.findMany({
      where: { userId, compoundId: compoundId.toLowerCase() },
      select: { outcomeKey: true, prior: true },
    })

    if (userPriors.length === 0) return populationMap

    const result: Record<string, FallbackEffect> = { ...populationMap }
    for (const row of userPriors) {
      const pop = populationMap[row.outcomeKey]
      result[row.outcomeKey] = {
        targetDeltaPct: row.prior,
        halfLifeWeeks: pop?.halfLifeWeeks ?? 8,
      }
    }
    return result
  } catch (err) {
    logger.warn("getEffectPriors DB lookup failed, using population defaults", {
      userId,
      compoundId,
      error: String(err),
    })
    return populationMap
  }
}

/**
 * Applies a Bayesian update to the user's prior for one compound–outcome pair.
 *
 *   new_prior = (n × old_prior + observed) / (n + 1)
 *
 * Bounded to ±50% of the population default so a single outlier cycle
 * can't push the prior to an implausible extreme.
 *
 * Never throws.
 */
export async function updateEffectPrior(
  userId: string,
  adjustment: PriorAdjustment,
): Promise<void> {
  const { compoundId, outcomeKey, observedDeltaPct } = adjustment
  const normalizedCompound = compoundId.toLowerCase()
  const normalizedOutcome = outcomeKey.toLowerCase()

  const pop = populationDefault(normalizedCompound, normalizedOutcome)
  const populationDefaultVal = pop?.targetDeltaPct ?? observedDeltaPct

  try {
    const existing = await db.userTwinPrior.findUnique({
      where: {
        userId_compoundId_outcomeKey: {
          userId,
          compoundId: normalizedCompound,
          outcomeKey: normalizedOutcome,
        },
      },
      select: { prior: true, n: true },
    })

    const oldPrior = existing?.prior ?? populationDefaultVal
    const n = existing?.n ?? 0
    const newN = n + 1

    // Bayesian update
    let newPrior = (n * oldPrior + observedDeltaPct) / newN

    // Bound to ±50% of population default
    const maxDeviation = Math.abs(populationDefaultVal) * 0.5 || 0.1
    if (populationDefaultVal < 0) {
      newPrior = Math.max(populationDefaultVal - maxDeviation, Math.min(populationDefaultVal + maxDeviation, newPrior))
    } else {
      newPrior = Math.max(populationDefaultVal - maxDeviation, Math.min(populationDefaultVal + maxDeviation, newPrior))
    }

    await db.userTwinPrior.upsert({
      where: {
        userId_compoundId_outcomeKey: {
          userId,
          compoundId: normalizedCompound,
          outcomeKey: normalizedOutcome,
        },
      },
      update: { prior: newPrior, n: newN },
      create: {
        userId,
        compoundId: normalizedCompound,
        outcomeKey: normalizedOutcome,
        prior: newPrior,
        populationDefault: populationDefaultVal,
        n: newN,
      },
    })

    logger.info("UserTwinPrior updated", {
      userId,
      compoundId: normalizedCompound,
      outcomeKey: normalizedOutcome,
      oldPrior,
      newPrior,
      n: newN,
    })
  } catch (err) {
    logger.error("updateEffectPrior failed", {
      userId,
      compoundId: normalizedCompound,
      outcomeKey: normalizedOutcome,
      error: String(err),
    })
  }
}
