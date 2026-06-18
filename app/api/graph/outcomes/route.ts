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
import { KgEdgeType, KgEvidenceGrade, type Prisma } from "@prisma/client"

import { authOptions } from "@/lib/auth"
import { RWE_SOURCE } from "@/lib/flywheel/causal-edge-materializer"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import {
  gradeMeets,
  RWE_QUERY_FRAMING,
  shapeRweOutcomes,
  type RweEdgeRow,
} from "@/lib/knowledge-graph/rwe-query"

const VALID_GRADES = new Set<string>(Object.values(KgEvidenceGrade))

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
  const intervention = searchParams.get("intervention")?.trim() || null
  const biomarker = searchParams.get("biomarker")?.trim() || null
  const minGradeParam = searchParams.get("minGrade")?.trim() || null
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50) || 50, 1), 200)

  if (minGradeParam && !VALID_GRADES.has(minGradeParam)) {
    return NextResponse.json(
      { error: `Invalid minGrade. Use one of: ${[...VALID_GRADES].join(", ")}` },
      { status: 400 },
    )
  }

  // Grades at or above the requested minimum (RWE only ever reaches C_LOW).
  const gradeFilter: KgEvidenceGrade[] | undefined = minGradeParam
    ? Object.values(KgEvidenceGrade).filter((g) => gradeMeets(g, minGradeParam as KgEvidenceGrade))
    : undefined

  const where: Prisma.KgEdgeWhereInput = {
    edgeType: KgEdgeType.POPULATION_ASSOCIATION,
    source: RWE_SOURCE,
    ...(gradeFilter ? { evidenceGrade: { in: gradeFilter } } : {}),
    ...(intervention ? { fromNode: { label: { contains: intervention, mode: "insensitive" } } } : {}),
    ...(biomarker ? { toNode: { label: { contains: biomarker, mode: "insensitive" } } } : {}),
  }

  try {
    const rows = await db.kgEdge.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        evidenceGrade: true,
        source: true,
        effectSize: true,
        effectSizeUnit: true,
        confidence: true,
        attributes: true,
        fromNode: { select: { label: true, kind: true, externalId: true } },
        toNode: { select: { label: true, kind: true, externalId: true } },
      },
    })

    const { outcomes, suppressedBelowFloor } = shapeRweOutcomes(rows as RweEdgeRow[])

    return NextResponse.json({
      outcomes,
      count: outcomes.length,
      suppressedBelowFloor,
      framing: RWE_QUERY_FRAMING,
      query: { intervention, biomarker, minGrade: minGradeParam, limit },
    })
  } catch (err) {
    logger.error("Failed to query RWE outcomes", {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Failed to query outcomes" }, { status: 500 })
  }
}
