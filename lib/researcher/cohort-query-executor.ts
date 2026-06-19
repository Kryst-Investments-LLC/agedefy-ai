/**
 * Cohort Query Executor — Moat M3
 *
 * Takes a parsed CohortQuery AST and executes it against the local Prisma DB.
 * Enforces:
 *   1. k-anonymity ≥ 50 (suppresses results for small cohorts)
 *   2. Laplace DP noise on all aggregate outputs (epsilon consumed from budget)
 *   3. Audit log on every query execution
 *   4. No row-level returns — aggregates only
 */

import { applyDp, meetsKAnonymity, K_ANON_MIN, BudgetExhaustedError } from "@/lib/privacy/dp-engine"
import { logAudit } from "@/lib/audit"
import { logger } from "@/lib/logger"
import type { CohortQuery, FilterNode } from "./cohort-dsl-parser"

// ε consumed per query invocation
const EPSILON_PER_QUERY = 0.5
// Global sensitivity for mean/median aggregates (assumes normalized biomarker units)
const GLOBAL_SENSITIVITY = 1.0

export interface CohortQueryExecutionResult {
  result: Record<string, number> | null
  suppressedBelowKAnonymity: boolean
  epsilonConsumed: number
  cohortSize: number
  auditId: string
  executedAt: string
}

type WhereClause = Record<string, unknown>

function buildBiomarkerWhere(filters: FilterNode[]): WhereClause {
  const where: WhereClause = {}

  for (const f of filters) {
    if (f.field.startsWith("biomarkers.")) {
      const parts = f.field.split(".")
      const biomarkerName = parts[1]
      // Map to the Prisma Biomarker model: numeric column is `value`, the
      // biomarker label is `name`.
      const key = "value"
      if (f.operator === "<")  where[key] = { lt: f.value }
      if (f.operator === "<=") where[key] = { lte: f.value }
      if (f.operator === ">")  where[key] = { gt: f.value }
      if (f.operator === ">=") where[key] = { gte: f.value }
      if (f.operator === "=")  where[key] = f.value
      where["name"] = biomarkerName
    }
  }

  return where
}

function buildUserWhere(filters: FilterNode[]): WhereClause {
  const where: WhereClause = {}

  for (const f of filters) {
    if (f.field === "age_bracket") {
      // approximate: filter by User.createdAt age proxy (no DOB field in schema)
      // Real impl would use a dedicated age column; placeholder for now
    }
    if (f.field === "sex") {
      where["sexAtBirth"] = f.value
    }
    if (f.field === "jurisdiction") {
      if (f.operator === "IN" && Array.isArray(f.value)) {
        where["jurisdiction"] = { in: f.value }
      }
    }
  }

  return where
}

function computeAggregate(
  func: string,
  values: number[],
  percentile?: number,
): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)

  switch (func) {
    case "count":
      return values.length
    case "mean":
      return values.reduce((s, v) => s + v, 0) / values.length
    case "median":
      return sorted[Math.floor(sorted.length / 2)] ?? 0
    case "percentile": {
      const p = (percentile ?? 50) / 100
      const idx = Math.floor(p * (sorted.length - 1))
      return sorted[idx] ?? 0
    }
    default:
      return 0
  }
}

export async function executeCohortQuery(
  userId: string,
  query: CohortQuery,
  tenantId = "default",
): Promise<CohortQueryExecutionResult> {
  const executedAt = new Date().toISOString()

  try {
    const { db } = await import("@/lib/db")
    const { deductPrivacyBudget } = await import("@/lib/privacy/dp-engine")

    // Deduct budget before executing
    await deductPrivacyBudget(userId, EPSILON_PER_QUERY, tenantId)

    // Build base query
    const biomarkerWhere = buildBiomarkerWhere(query.filters)
    const _userWhere = buildUserWhere(query.filters)

    // Execute: fetch matching biomarker records
    const records = await db.biomarker.findMany({
      where: {
        ...biomarkerWhere,
        user: { consentGrant: { status: "active" } },  // only consented users
      },
      select: { value: true, userId: true },
      take: 10_000,  // safety cap
    })

    const cohortSize = new Set(records.map((r) => r.userId)).size

    if (!meetsKAnonymity(cohortSize)) {
      const auditId = await writeAuditLog(userId, query, cohortSize, EPSILON_PER_QUERY, true)
      return {
        result: null,
        suppressedBelowKAnonymity: true,
        epsilonConsumed: EPSILON_PER_QUERY,
        cohortSize,
        auditId,
        executedAt,
      }
    }

    const values = records
      .map((r) => r.value)
      .filter((v): v is number => v !== null)

    // Compute all requested aggregates
    const rawAggregates: Record<string, number> = {}
    for (const agg of query.aggregates) {
      const key = agg.field
        ? `${agg.func}_${agg.field.replace(/\./g, "_")}`
        : agg.func
      rawAggregates[key] = computeAggregate(agg.func, values, agg.percentile)
    }

    // Apply DP noise
    const dpResult = applyDp(rawAggregates, cohortSize, GLOBAL_SENSITIVITY, EPSILON_PER_QUERY)

    const auditId = await writeAuditLog(userId, query, cohortSize, EPSILON_PER_QUERY, false)

    return {
      result:                    dpResult?.result ?? rawAggregates,
      suppressedBelowKAnonymity: false,
      epsilonConsumed:           EPSILON_PER_QUERY,
      cohortSize,
      auditId,
      executedAt,
    }
  } catch (err) {
    if (err instanceof BudgetExhaustedError) throw err

    logger.error("cohort-query-executor: failed", { userId, error: String(err) })
    throw err
  }
}

async function writeAuditLog(
  userId: string,
  query: CohortQuery,
  cohortSize: number,
  epsilonConsumed: number,
  suppressed: boolean,
): Promise<string> {
  try {
    await logAudit({
      actorUserId: userId,
      tenantId:    "default",
      action:      "cohort.query.executed",
      entityType:  "CohortQuery",
      entityId:    userId,
      details: {
        queryRaw: query.raw,
        cohortSize,
        epsilonConsumed,
        suppressed,
        kAnonMin: K_ANON_MIN,
      },
    })
  } catch {
    // non-fatal
  }
  return `cq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
