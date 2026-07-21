/**
 * Cron / Job: RWE Edge Materialisation
 *
 * GET /api/cron/materialize-rwe-edges — projects de-identified AggregateOutcome
 * rows for a period into the knowledge graph as POPULATION_ASSOCIATION edges.
 *
 * Runs independently of the nightly aggregation so the graph can be re-built
 * for any period without re-aggregating. Secured via CRON_SECRET (fail-closed).
 *
 * Query params:
 *   period   — AggregateOutcome.period to project (default: current "YYYY-MM")
 *   tenantId — tenant scope (default "default")
 *
 * @module app/api/cron/materialize-rwe-edges/route
 */

import { NextRequest, NextResponse } from "next/server"

import { materializeRweEdges } from "@/lib/flywheel/materialize-rwe-edges"
import { logger } from "@/lib/logger"
import { requireCronAuthorization } from "@/lib/security/cron-auth"

export const runtime = "nodejs"
export const maxDuration = 300 // 5 minutes max

export async function GET(request: NextRequest) {
  const unauthorized = requireCronAuthorization(request)
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const period = searchParams.get("period") ?? defaultPeriod
  const tenantId = searchParams.get("tenantId") ?? "default"

  try {
    const result = await materializeRweEdges(period, tenantId)
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    logger.error("RWE edge materialisation failed", {
      period,
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "Materialisation failed" }, { status: 500 })
  }
}
