import type { Prisma, PrismaClient } from "@prisma/client"

import { db } from "@/lib/db"
import { env } from "@/lib/env"

/**
 * Differential-privacy composition budget (P1-GOV-013).
 *
 * Each published DP-noised statistic leaks ~epsilon of privacy; under sequential
 * composition, repeated/retried/joined queries leak the SUM of their epsilons. A
 * fixed per-window budget bounds that cumulative leakage: every run debits its
 * epsilon against a (tenant, scope) budget, and once the window's budget is
 * exhausted further runs are refused until the window rolls forward.
 */

type PrismaClientLike = PrismaClient | Prisma.TransactionClient

const DEFAULT_EPSILON_BUDGET = 10 // total epsilon per (tenant, scope) per window
const DEFAULT_WINDOW_HOURS = 24

function parsePositiveFloat(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "")
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Total DP epsilon allowed per (tenant, scope) within one rolling window. */
export function getEpsilonBudget(): number {
  return parsePositiveFloat(env.PRIVACY_EPSILON_BUDGET, DEFAULT_EPSILON_BUDGET)
}

/** Rolling accounting window in milliseconds. */
export function getBudgetWindowMs(): number {
  return parsePositiveFloat(env.PRIVACY_EPSILON_WINDOW_HOURS, DEFAULT_WINDOW_HOURS) * 60 * 60 * 1000
}

/** Epsilon already debited for (tenant, scope) since `since`. */
export async function getSpentEpsilon(
  tenantId: string,
  scope: string,
  since: Date,
  client: PrismaClientLike = db,
): Promise<number> {
  const aggregate = await client.privacyBudgetEntry.aggregate({
    where: { tenantId, scope, spentAt: { gte: since } },
    _sum: { epsilon: true },
  })
  return aggregate._sum.epsilon ?? 0
}

/** Remaining epsilon for (tenant, scope) in the current window. */
export async function getRemainingEpsilon(
  tenantId: string,
  scope: string,
  now: Date = new Date(),
  client: PrismaClientLike = db,
): Promise<number> {
  const since = new Date(now.getTime() - getBudgetWindowMs())
  const spent = await getSpentEpsilon(tenantId, scope, since, client)
  return Math.max(0, getEpsilonBudget() - spent)
}

export interface EpsilonReservation {
  granted: boolean
  requested: number
  /** Remaining budget AFTER this reservation (unchanged when not granted). */
  remaining: number
  budget: number
}

/**
 * Atomically reserve epsilon from the (tenant, scope) budget. Serialized per
 * (tenant, scope) with a transaction-scoped advisory lock so two concurrent runs
 * can't both pass the check and over-spend. Records a debit and returns
 * granted:true when enough remains; otherwise records nothing and returns
 * granted:false.
 */
export async function reserveEpsilon(
  tenantId: string,
  scope: string,
  epsilon: number,
  now: Date = new Date(),
  client: PrismaClient = db,
): Promise<EpsilonReservation> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('privacy-budget'), hashtext(${`${tenantId}:${scope}`}))`
    const budget = getEpsilonBudget()
    const remaining = await getRemainingEpsilon(tenantId, scope, now, tx)
    if (epsilon > remaining) {
      return { granted: false, requested: epsilon, remaining, budget }
    }
    await tx.privacyBudgetEntry.create({ data: { tenantId, scope, epsilon, spentAt: now } })
    return { granted: true, requested: epsilon, remaining: remaining - epsilon, budget }
  })
}
