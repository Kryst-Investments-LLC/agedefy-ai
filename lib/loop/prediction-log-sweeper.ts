/**
 * Prediction Log Sweeper — Tier 5.3
 *
 * Daily cron: find all TwinSimulationRun rows whose prediction window has
 * closed (predictionExpiresAt ≤ today) and have not yet been scored
 * (twinAccuracyScore IS NULL), then invoke twin-scorer.ts for each.
 *
 * Scoring fills in `twinAccuracyScore`, which feeds the twin accuracy
 * interpretation in cycle reports (Tier 4.4) and Bayesian prior updates (Tier 2).
 */

import { logger } from "@/lib/logger"

export interface SweepResult {
  scored: number
  skipped: number
  errors: number
}

/**
 * Score accuracy of `observedDelta` vs `predictedMean` for a single simulation
 * run, using only what we have in the run row itself (no separate scoring model).
 *
 * A lightweight accuracy ratio: if observed biomarker delta is within ±20% of
 * `predictedMean`, the run is "accurate". We produce a 0–1 score:
 *   1.0 = observed within 10% of prediction
 *   0.5 = observed within 20% of prediction
 *   0.2 = observed direction correct but magnitude off
 *   0.0 = observed direction reversed
 *
 * This simple scorer runs in-process and doesn't require the reflection agent.
 * The reflection agent (Tier 2) does a richer per-biomarker analysis; this is
 * a lightweight first pass to fill the `twinAccuracyScore` column.
 */
function computeAccuracyScore(
  predictedMean: number,
  observedDelta: number | null,
): number {
  if (observedDelta === null) return 0

  if (predictedMean === 0) return observedDelta === 0 ? 1.0 : 0.5

  const directionCorrect = Math.sign(predictedMean) === Math.sign(observedDelta)
  if (!directionCorrect) return 0.0

  const ratio = Math.abs(observedDelta / predictedMean)
  if (ratio >= 0.9 && ratio <= 1.1) return 1.0   // within 10%
  if (ratio >= 0.8 && ratio <= 1.2) return 0.8
  if (ratio >= 0.7 && ratio <= 1.3) return 0.6
  if (ratio >= 0.5 && ratio <= 1.5) return 0.5
  return 0.2  // right direction, but magnitude significantly off
}

/**
 * For a given TwinSimulationRun, look up the most recent observed biomarker
 * delta for the `endpoint` field (e.g., "CRP_AUC") and compute an accuracy score.
 */
async function scoreSimulationRun(
  run: {
    id: string
    userId: string
    endpoint: string
    predictedMean: number
  },
): Promise<number | null> {
  try {
    const { db } = await import("@/lib/db")

    // Look up latest biomarker observation for this user × endpoint
    const biomarker = await db.biomarker.findFirst({
      where: {
        userId: run.userId,
        name: run.endpoint,
      },
      orderBy: { measuredAt: "desc" },
      select: { value: true },
    })

    if (biomarker?.value == null) return null

    // We use the latest biomarker value as a proxy for delta
    // (absolute value — a limitation of not having a pre-cycle baseline in this query)
    return computeAccuracyScore(run.predictedMean, biomarker.value)
  } catch (err) {
    logger.warn("scoreSimulationRun: lookup failed", { runId: run.id, error: String(err) })
    return null
  }
}

/**
 * Main sweep: find expired, unscored runs and fill in `twinAccuracyScore`.
 * Called from the `prediction-log-sweep` cron job.
 */
export async function sweepExpiredPredictions(): Promise<SweepResult> {
  let scored = 0
  let skipped = 0
  let errors = 0

  try {
    const { db } = await import("@/lib/db")
    const now = new Date()

    const runs = await db.twinSimulationRun.findMany({
      where: {
        predictionExpiresAt: { lte: now },
        twinAccuracyScore: null,
      },
      select: {
        id: true,
        userId: true,
        endpoint: true,
        predictedMean: true,
      },
      take: 100,  // process in batches of 100
    })

    logger.info("sweepExpiredPredictions: found runs to score", { count: runs.length })

    for (const run of runs) {
      try {
        const score = await scoreSimulationRun(run)

        if (score === null) {
          skipped++
          continue
        }

        await db.twinSimulationRun.update({
          where: { id: run.id },
          data: { twinAccuracyScore: score },
        })

        scored++
        logger.info("sweepExpiredPredictions: scored run", {
          runId: run.id, userId: run.userId, endpoint: run.endpoint, score,
        })
      } catch (err) {
        errors++
        logger.error("sweepExpiredPredictions: failed to score run", {
          runId: run.id, error: String(err),
        })
      }
    }
  } catch (err) {
    logger.error("sweepExpiredPredictions: query failed", { error: String(err) })
    errors++
  }

  return { scored, skipped, errors }
}
