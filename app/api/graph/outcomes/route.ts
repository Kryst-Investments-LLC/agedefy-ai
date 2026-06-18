/**
 * GET /api/graph/outcomes
 *
 * Researcher-gated query over the knowledge graph's population real-world-evidence
 * (RWE) edges — the de-identified flywheel data product. Returns observational
 * compound→biomarker associations materialised by the outcome flywheel.
 *
 * This is the B2B research surface, NOT a consumer recommendation engine:
 *   - Role gate: RESEARCHER or ADMIN only.
 *   - Population/aggregate only — no userId filter, no individual-level rows.
 *   - k-anonymity floor re-enforced at read time (defense-in-depth).
 *   - Every response carries the "research information, not medical advice"
 *     and "association, not validated mechanism" framing.
 *
 * Query params:
 *   intervention — case-insensitive substring match on the from-node label
 *   biomarker    — case-insensitive substring match on the to-node label
 *   minGrade     — minimum evidence grade (A_HIGH|B_MODERATE|C_LOW|D_VERY_LOW)
 *   limit        — max rows (default 50, max 200)
 *
 * @module app/api/graph/outcomes/route
 */

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import { RWE_QUERY_FRAMING } from "@/lib/knowledge-graph/rwe-query"
import { parseRweQueryParams, queryRweOutcomes } from "@/lib/knowledge-graph/rwe-outcomes-query"

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = (session.user as { role?: string }).role
  if (role !== "RESEARCHER" && role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden: graph outcomes require RESEARCHER or ADMIN role" },
      { status: 403 },
    )
  }

  const { searchParams } = new URL(request.url)
  const parsed = parseRweQueryParams(searchParams)
  if (parsed.error || !parsed.params) {
    return NextResponse.json({ error: parsed.error ?? "Invalid query" }, { status: 400 })
  }

  try {
    const result = await queryRweOutcomes(parsed.params)
    return NextResponse.json({
      outcomes: result.outcomes,
      count: result.count,
      suppressedBelowFloor: result.suppressedBelowFloor,
      framing: RWE_QUERY_FRAMING,
      query: {
        intervention: parsed.params.intervention,
        biomarker: parsed.params.biomarker,
        minGrade: parsed.params.minGrade,
        limit: parsed.params.limit,
      },
    })
  } catch (err) {
    logger.error("Failed to query RWE outcomes", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to query outcomes" }, { status: 500 })
  }
}
