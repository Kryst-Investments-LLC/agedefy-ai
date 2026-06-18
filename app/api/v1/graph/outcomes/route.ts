/**
 * GET /api/v1/graph/outcomes
 *
 * External, metered access to the population real-world-evidence (RWE) data
 * product. Same query + guardrails as the internal /api/graph/outcomes, but
 * authenticated with a platform-issued API key carrying the `graph:read` scope.
 *
 * 1C productisation:
 *   - API-key auth (Bearer ak_...) + per-key rate limiting
 *   - `graph:read` scope required
 *   - every call metered into APIUsageRecord (recordUsage)
 *   - every call audit-logged (action "graph.query")
 *   - usage reported to the billing hook (stub until STRIPE_GRAPH_PRICE_ID set)
 *
 * Guardrails are inherited from the shared query service: population/aggregate
 * only, k-anon floor re-enforced, no individual-level rows, mandatory framing.
 *
 * @module app/api/v1/graph/outcomes/route
 */

import { NextRequest, NextResponse } from "next/server"

import { authenticateAPIKey, requireScope, type APIKeyContext } from "@/lib/api-keys/middleware"
import { recordUsage } from "@/lib/api-keys/metering"
import { logAudit } from "@/lib/audit"
import { reportGraphQueryUsage } from "@/lib/billing/graph-usage-billing"
import { logger } from "@/lib/logger"
import { RWE_QUERY_FRAMING } from "@/lib/knowledge-graph/rwe-query"
import { parseRweQueryParams, queryRweOutcomes } from "@/lib/knowledge-graph/rwe-outcomes-query"

const ENDPOINT = "/v1/graph/outcomes"
const GRAPH_READ_SCOPE = "graph:read"

export async function GET(request: NextRequest) {
  const start = Date.now()

  const authResult = await authenticateAPIKey(request)
  if (authResult instanceof NextResponse) return authResult
  const ctx = authResult as APIKeyContext

  const scopeBlocked = requireScope(ctx, GRAPH_READ_SCOPE)
  if (scopeBlocked) {
    await recordUsage({ keyId: ctx.key.id, endpoint: ENDPOINT, method: "GET", statusCode: 403, computeMs: Date.now() - start })
    return scopeBlocked
  }

  const { searchParams } = new URL(request.url)
  const parsed = parseRweQueryParams(searchParams)
  if (parsed.error || !parsed.params) {
    await recordUsage({ keyId: ctx.key.id, endpoint: ENDPOINT, method: "GET", statusCode: 400, computeMs: Date.now() - start })
    return NextResponse.json({ error: parsed.error ?? "Invalid query" }, { status: 400 })
  }

  try {
    const result = await queryRweOutcomes(parsed.params)

    await recordUsage({ keyId: ctx.key.id, endpoint: ENDPOINT, method: "GET", statusCode: 200, computeMs: Date.now() - start })

    await logAudit({
      actorUserId: ctx.key.userId,
      tenantId: ctx.key.tenantId,
      action: "graph.query",
      entityType: "RweOutcomeQuery",
      details: {
        keyId: ctx.key.id,
        query: parsed.params,
        count: result.count,
        suppressedBelowFloor: result.suppressedBelowFloor,
      },
    })

    // Report metered usage for billing (stub until STRIPE_GRAPH_PRICE_ID is set).
    await reportGraphQueryUsage({ keyId: ctx.key.id, units: 1 })

    return NextResponse.json({
      outcomes: result.outcomes,
      count: result.count,
      suppressedBelowFloor: result.suppressedBelowFloor,
      framing: RWE_QUERY_FRAMING,
      query: parsed.params,
    })
  } catch (err) {
    await recordUsage({ keyId: ctx.key.id, endpoint: ENDPOINT, method: "GET", statusCode: 500, computeMs: Date.now() - start })
    logger.error("v1 graph outcomes query failed", { keyId: ctx.key.id, error: String(err) })
    return NextResponse.json({ error: "Failed to query outcomes" }, { status: 500 })
  }
}
