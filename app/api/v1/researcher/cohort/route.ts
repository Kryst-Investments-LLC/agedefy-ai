/**
 * POST /api/v1/researcher/cohort
 *
 * Execute a cohort DSL query against consented biomarker data.
 *
 * Requirements:
 *   - RESEARCHER role
 *   - Valid, non-expired IrbApproval token (header: X-IRB-Token)
 *   - Rate limit: 10 queries / hour per researcher
 *   - Every response includes: { result, suppressed_below_k_anonymity,
 *     epsilon_consumed, auditId }
 *
 * Privacy guarantees:
 *   - k-anonymity ≥ 50 (result suppressed for smaller cohorts)
 *   - Laplace DP noise on all aggregate values
 *   - Budget deducted from researcher's monthly ε allowance
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { requireAuthWithRole } from "@/lib/rbac"
import { parseCohortDsl, ParseError } from "@/lib/researcher/cohort-dsl-parser"
import { executeCohortQuery } from "@/lib/researcher/cohort-query-executor"
import { BudgetExhaustedError } from "@/lib/privacy/dp-engine"

const RATE_LIMIT_PER_HOUR = 10

const bodySchema = z.object({
  query: z.string().min(10).max(2000),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  const authError = requireAuthWithRole(session, "RESEARCHER", "ADMIN")
  if (authError) return authError

  // Validate IRB token
  const irbToken = req.headers.get("x-irb-token")
  if (!irbToken) {
    return NextResponse.json(
      { error: "X-IRB-Token header required for cohort queries" },
      { status: 403 },
    )
  }

  const irb = await db.irbApproval.findUnique({
    where: { token: irbToken },
    select: { userId: true, expiresAt: true, revokedAt: true },
  })

  if (!irb || irb.userId !== session!.user.id) {
    return NextResponse.json({ error: "Invalid IRB token" }, { status: 403 })
  }
  if (irb.revokedAt || irb.expiresAt < new Date()) {
    return NextResponse.json({ error: "IRB token expired or revoked" }, { status: 403 })
  }

  // Rate limit: count queries in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentCount = await db.auditLog.count({
    where: {
      actorUserId: session!.user.id,
      action: "cohort.query.executed",
      createdAt: { gte: oneHourAgo },
    },
  })

  if (recentCount >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: `Rate limit exceeded: ${RATE_LIMIT_PER_HOUR} cohort queries per hour` },
      { status: 429 },
    )
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: String(err) }, { status: 400 })
  }

  // Parse the DSL
  let parsedQuery
  try {
    parsedQuery = parseCohortDsl(body.query)
  } catch (err) {
    if (err instanceof ParseError) {
      return NextResponse.json({ error: "DSL parse error", details: err.message }, { status: 400 })
    }
    throw err
  }

  // Execute
  try {
    const result = await executeCohortQuery(session!.user.id, parsedQuery)

    logger.info("Cohort query executed", {
      userId: session!.user.id,
      cohortSize: result.cohortSize,
      suppressed: result.suppressedBelowKAnonymity,
      epsilon: result.epsilonConsumed,
    })

    return NextResponse.json({
      result:                       result.result,
      suppressed_below_k_anonymity: result.suppressedBelowKAnonymity,
      epsilon_consumed:             result.epsilonConsumed,
      cohort_size:                  result.cohortSize,
      auditId:                      result.auditId,
      executed_at:                  result.executedAt,
    })
  } catch (err) {
    if (err instanceof BudgetExhaustedError) {
      return NextResponse.json(
        { error: "Privacy budget exhausted for this month", details: err.message },
        { status: 429 },
      )
    }
    logger.error("POST /api/v1/researcher/cohort failed", { error: String(err) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
