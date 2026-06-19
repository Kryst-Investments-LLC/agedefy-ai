/**
 * Shadow Router — Moat M5
 *
 * Routes a configurable percentage of production traffic to a distilled
 * model in parallel with the primary model. Compares quality scores and
 * promotes the distilled model when it matches within QUALITY_TOLERANCE.
 *
 * Shadow routing: the primary response is always returned to the caller;
 * the distilled model's response is evaluated asynchronously.
 *
 * Safety: shadow calls never affect the user-visible response.
 */

import { logger } from "@/lib/logger"

export const SHADOW_TRAFFIC_FRACTION = 0.05   // 5% of traffic
export const QUALITY_TOLERANCE = 0.03          // distilled within 3% of primary → promote
export const PROMOTION_SAMPLE_MIN = 100        // minimum samples before promotion decision

export interface ShadowRouterConfig {
  shadowFraction?: number
  qualityTolerance?: number
  promotionSampleMin?: number
  distilledModelId?: string
}

export interface ShadowEvalResult {
  primaryScore:   number
  distilledScore: number
  delta:          number
  withinTolerance: boolean
  sampleCount:    number
  promotionReady: boolean
}

// In-memory accumulator (per process; in production, use Redis or a metrics backend)
const accumulator = {
  sampleCount: 0,
  primaryScoreSum: 0,
  distilledScoreSum: 0,
}

/**
 * Decide whether to shadow-route this request.
 * Deterministic per-request using Math.random() — suitable for stateless routing.
 */
export function shouldShadowRoute(fraction: number = SHADOW_TRAFFIC_FRACTION): boolean {
  return Math.random() < fraction
}

/**
 * Execute a shadow call and record quality scores.
 * Both calls are made in parallel; the primary result is returned immediately.
 * The shadow call is fire-and-forget from the caller's perspective.
 *
 * @param primaryCall   The production model call (already made by caller)
 * @param shadowCall    A promise that returns { output, qualityScore }
 * @param primaryScore  Quality score from the production call
 */
export async function recordShadowComparison(
  primaryScore: number,
  distilledScore: number,
  config: ShadowRouterConfig = {},
): Promise<ShadowEvalResult> {
  const tolerance = config.qualityTolerance ?? QUALITY_TOLERANCE
  const minSamples = config.promotionSampleMin ?? PROMOTION_SAMPLE_MIN

  accumulator.sampleCount++
  accumulator.primaryScoreSum += primaryScore
  accumulator.distilledScoreSum += distilledScore

  const delta = Math.abs(primaryScore - distilledScore)
  const withinTolerance = delta <= tolerance
  const promotionReady =
    accumulator.sampleCount >= minSamples &&
    (accumulator.distilledScoreSum / accumulator.sampleCount) >=
    (accumulator.primaryScoreSum / accumulator.sampleCount) - tolerance

  const result: ShadowEvalResult = {
    primaryScore,
    distilledScore,
    delta,
    withinTolerance,
    sampleCount: accumulator.sampleCount,
    promotionReady,
  }

  if (promotionReady) {
    logger.info("shadow-router: distilled model ready for promotion", {
      avgPrimary:   (accumulator.primaryScoreSum / accumulator.sampleCount).toFixed(3),
      avgDistilled: (accumulator.distilledScoreSum / accumulator.sampleCount).toFixed(3),
      sampleCount:  accumulator.sampleCount,
    })
  }

  logger.info("shadow-router: comparison recorded", {
    primaryScore, distilledScore, delta, withinTolerance,
  })

  return result
}

/**
 * Reset the accumulator (used in tests and after a promotion decision).
 */
export function resetShadowAccumulator(): void {
  accumulator.sampleCount = 0
  accumulator.primaryScoreSum = 0
  accumulator.distilledScoreSum = 0
}

/**
 * Get current accumulator snapshot without modifying it.
 */
export function getShadowStats() {
  const n = accumulator.sampleCount
  return {
    sampleCount:      n,
    avgPrimaryScore:  n > 0 ? accumulator.primaryScoreSum / n : null,
    avgDistilledScore: n > 0 ? accumulator.distilledScoreSum / n : null,
  }
}
