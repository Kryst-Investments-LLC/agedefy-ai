/**
 * Federated Learning — round metric aggregation + DP budget enforcement (pure)
 *
 * Complements the existing FL modules:
 *   - lib/fl/secure-aggregation.ts — privately aggregates gradient VECTORS.
 *   - lib/fl/gradient-privacy.ts   — DP-SGD primitives + epsilon COMPOSITION
 *                                    (composedEpsilon / maxPerStepEpsilon).
 *
 * This module adds the two pieces those don't cover:
 *   - aggregateRound(): FedAvg of round METRICS (loss/accuracy), sample-size
 *     weighted — used to publish a model version's headline metrics.
 *   - checkEpsilonBudget(): operational enforcement of a participant's CUMULATIVE
 *     recorded epsilon against a budget, so a contributor cannot leak unbounded
 *     privacy across rounds. (The per-step/composition math lives in
 *     gradient-privacy.ts; this is the running-total gate the participate route
 *     applies against recorded FLParticipation.epsilonSpent.)
 *
 * Pure — no DB, no I/O.
 *
 * @module lib/fl/round-aggregation
 */

/** Total DP budget (epsilon) a single participant may spend per model. */
export const EPSILON_BUDGET_DEFAULT = 10

/** Minimum contributors before a round may be aggregated/published. */
export const FL_MIN_CLIENTS = 3

export interface Contribution {
  localSampleSize: number
  localLoss?: number | null
  localAccuracy?: number | null
  epsilonSpent?: number | null
}

export interface RoundAggregate {
  contributors: number
  totalSampleSize: number
  /** Sample-size-weighted mean loss (FedAvg), or null if no usable losses. */
  weightedLoss: number | null
  /** Sample-size-weighted mean accuracy, or null if no usable accuracies. */
  weightedAccuracy: number | null
  /** Sum of DP epsilon spent across contributions. */
  totalEpsilon: number
  /** True when contributors ≥ minClients — the round may be aggregated. */
  ready: boolean
}

/** Sample-size-weighted mean of a metric across contributions (FedAvg). */
function weightedMean(
  contributions: Contribution[],
  pick: (c: Contribution) => number | null | undefined,
): number | null {
  let num = 0
  let den = 0
  for (const c of contributions) {
    const v = pick(c)
    if (typeof v !== "number" || !Number.isFinite(v)) continue
    if (!Number.isFinite(c.localSampleSize) || c.localSampleSize <= 0) continue
    num += c.localSampleSize * v
    den += c.localSampleSize
  }
  return den > 0 ? num / den : null
}

/**
 * Aggregate one federated round via FedAvg. Metrics are weighted by each
 * client's local sample size; contributions missing a metric are excluded from
 * that metric only (but still counted toward contributors / epsilon).
 */
export function aggregateRound(
  contributions: Contribution[],
  minClients: number = FL_MIN_CLIENTS,
): RoundAggregate {
  const contributors = contributions.length
  const totalSampleSize = contributions.reduce(
    (s, c) => s + (Number.isFinite(c.localSampleSize) && c.localSampleSize > 0 ? c.localSampleSize : 0),
    0,
  )
  const totalEpsilon = contributions.reduce(
    (s, c) => s + (typeof c.epsilonSpent === "number" && c.epsilonSpent > 0 ? c.epsilonSpent : 0),
    0,
  )

  return {
    contributors,
    totalSampleSize,
    weightedLoss: weightedMean(contributions, (c) => c.localLoss),
    weightedAccuracy: weightedMean(contributions, (c) => c.localAccuracy),
    totalEpsilon,
    ready: contributors >= minClients,
  }
}

export interface EpsilonBudgetCheck {
  allowed: boolean
  cumulative: number
  requested: number
  budget: number
  remaining: number
  reason: string
}

/**
 * Enforce a participant's cumulative DP budget: the new request is allowed only
 * if it keeps total epsilon at or below the budget. Conservative linear running
 * total over recorded per-round epsilon (an upper bound on the true composed
 * epsilon from gradient-privacy.composedEpsilon).
 */
export function checkEpsilonBudget(
  cumulative: number,
  requested: number,
  budget: number = EPSILON_BUDGET_DEFAULT,
): EpsilonBudgetCheck {
  const safeCumulative = Number.isFinite(cumulative) && cumulative > 0 ? cumulative : 0
  const safeRequested = Number.isFinite(requested) && requested > 0 ? requested : 0
  const remaining = budget - safeCumulative
  const allowed = safeCumulative + safeRequested <= budget

  return {
    allowed,
    cumulative: safeCumulative,
    requested: safeRequested,
    budget,
    remaining: remaining > 0 ? remaining : 0,
    reason: allowed
      ? `Within DP budget: ${(safeCumulative + safeRequested).toFixed(3)} / ${budget} epsilon.`
      : `DP budget exceeded: ${safeCumulative.toFixed(3)} + ${safeRequested.toFixed(3)} > ${budget} epsilon.`,
  }
}
