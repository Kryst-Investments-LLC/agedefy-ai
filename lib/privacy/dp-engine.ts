/**
 * Differential Privacy Engine — Moat M1
 *
 * Provides Laplace mechanism noise injection and k-anonymity enforcement
 * for all cohort-level aggregate queries. Every query that touches user
 * biomarker data MUST pass through this module.
 *
 * Privacy model:
 *   - Laplace mechanism: noise ∝ sensitivity / epsilon
 *   - Global sensitivity for aggregate means/medians: assumed 1 unit
 *   - k-anonymity floor: minimum cohort size = 50 (K_ANON_MIN)
 *   - Per-user monthly epsilon budget: default ε_max = 4.0
 */

import { createHash } from "node:crypto"
import { logger } from "@/lib/logger"

export const K_ANON_MIN = 50
export const EPSILON_MAX_DEFAULT = 4.0

export interface DpQueryResult<T> {
  result: T
  suppressedBelowKAnonymity: boolean
  epsilonConsumed: number
  cohortSize: number
  auditId: string
}

/** Sample from Laplace distribution with scale b = sensitivity / epsilon */
function laplaceSample(sensitivity: number, epsilon: number): number {
  if (epsilon <= 0) throw new Error("epsilon must be positive")
  const b = sensitivity / epsilon
  const u = Math.random() - 0.5
  return -b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u))
}

/**
 * Apply Laplace noise to a numeric aggregate.
 * sensitivity: max change in output from adding/removing one user (typically 1)
 * epsilon: privacy budget to consume for this query
 */
export function addLaplaceNoise(
  value: number,
  sensitivity: number,
  epsilon: number,
): number {
  return value + laplaceSample(sensitivity, epsilon)
}

/**
 * Check k-anonymity floor. Returns true when cohortSize >= K_ANON_MIN.
 * When false, the result should be suppressed (return null to caller).
 */
export function meetsKAnonymity(cohortSize: number, k = K_ANON_MIN): boolean {
  return cohortSize >= k
}

/**
 * Wrap any aggregate result with DP noise and k-anonymity checks.
 * Returns null when the cohort is too small (k-anonymity not met).
 * Consumes epsilonToConsume from the per-query budget.
 */
export function applyDp<T extends Record<string, number>>(
  aggregates: T,
  cohortSize: number,
  sensitivity: number,
  epsilonToConsume: number,
): DpQueryResult<T> | null {
  const suppressedBelowKAnonymity = !meetsKAnonymity(cohortSize)

  const auditId = createHash("sha256")
    .update(`${Date.now()}${cohortSize}${epsilonToConsume}`)
    .digest("hex")
    .slice(0, 16)

  if (suppressedBelowKAnonymity) {
    logger.warn("dp-engine: result suppressed — k-anonymity not met", {
      cohortSize, kAnonMin: K_ANON_MIN, auditId,
    })
    return null
  }

  const noisedResult = Object.fromEntries(
    Object.entries(aggregates).map(([key, val]) => [
      key,
      addLaplaceNoise(val as number, sensitivity, epsilonToConsume),
    ]),
  ) as T

  return {
    result: noisedResult,
    suppressedBelowKAnonymity: false,
    epsilonConsumed: epsilonToConsume,
    cohortSize,
    auditId,
  }
}

/**
 * Deduct epsilon from a user's monthly privacy budget.
 * Throws BudgetExhaustedError when budget is exceeded.
 * Creates a fresh budget record if none exists for this period.
 */
export class BudgetExhaustedError extends Error {
  constructor(userId: string, used: number, max: number) {
    super(`Privacy budget exhausted for user ${userId}: used=${used.toFixed(2)}, max=${max.toFixed(2)}`)
    this.name = "BudgetExhaustedError"
  }
}

export async function deductPrivacyBudget(
  userId: string,
  epsilonToConsume: number,
  tenantId = "default",
): Promise<{ epsilonUsed: number; epsilonMax: number; queryCount: number }> {
  const { db } = await import("@/lib/db")
  const now = new Date()

  // Upsert budget record for the current calendar month
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  let budget = await db.userPrivacyBudget.findUnique({ where: { userId } })

  if (!budget || budget.periodEnd < now) {
    // New period — reset budget
    budget = await db.userPrivacyBudget.upsert({
      where: { userId },
      create: {
        userId, tenantId,
        epsilonUsed: 0, epsilonMax: EPSILON_MAX_DEFAULT,
        queryCount: 0, periodStart, periodEnd,
      },
      update: {
        epsilonUsed: 0, queryCount: 0, periodStart, periodEnd,
      },
    })
  }

  if (budget.epsilonUsed + epsilonToConsume > budget.epsilonMax) {
    throw new BudgetExhaustedError(userId, budget.epsilonUsed, budget.epsilonMax)
  }

  const updated = await db.userPrivacyBudget.update({
    where: { userId },
    data: {
      epsilonUsed: { increment: epsilonToConsume },
      queryCount:  { increment: 1 },
    },
  })

  return {
    epsilonUsed: updated.epsilonUsed,
    epsilonMax:  updated.epsilonMax,
    queryCount:  updated.queryCount,
  }
}

/**
 * Read current budget state without modifying it.
 * Returns null when no budget record exists (user has never run a cohort query).
 */
export async function getPrivacyBudget(userId: string) {
  const { db } = await import("@/lib/db")
  const now = new Date()
  const budget = await db.userPrivacyBudget.findUnique({ where: { userId } })
  if (!budget) return null

  // If budget period has expired, the used amount resets on next query
  const isCurrentPeriod = budget.periodEnd >= now
  return {
    epsilonUsed:  isCurrentPeriod ? budget.epsilonUsed : 0,
    epsilonMax:   budget.epsilonMax,
    queryCount:   isCurrentPeriod ? budget.queryCount : 0,
    periodStart:  budget.periodStart.toISOString(),
    periodEnd:    budget.periodEnd.toISOString(),
    resetDate:    budget.periodEnd.toISOString(),
    budgetRemaining: budget.epsilonMax - (isCurrentPeriod ? budget.epsilonUsed : 0),
  }
}
