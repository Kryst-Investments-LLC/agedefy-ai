import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { searchClinicalTrials } from "@/lib/clinical-trials"
import { createRequestContext, withRequestContextHeaders, logRequestEvent } from "@/lib/observability/request-context"
import { applyRateLimit } from "@/lib/rate-limit"

/**
 * GET /api/clinical-trials/search?q=<query>&limit=<n>
 * Real-time proxy to ClinicalTrials.gov v2 API
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const ctx = createRequestContext(request, { session })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)))

  if (!q || q.length < 2) {
    return withRequestContextHeaders(
      NextResponse.json({ error: "Provide ?q=<search query>" }, { status: 400 }),
      ctx,
    )
  }

  try {
    const trials = await searchClinicalTrials(q, limit)
    logRequestEvent("info", "clinical_trials_search_success", ctx, { count: trials.length })
    return withRequestContextHeaders(
      NextResponse.json({ trials, count: trials.length }),
      ctx,
    )
  } catch {
    logRequestEvent("error", "clinical_trials_search_failed", ctx)
    return withRequestContextHeaders(
      NextResponse.json({ error: "ClinicalTrials.gov search failed" }, { status: 502 }),
      ctx,
    )
  }
}
