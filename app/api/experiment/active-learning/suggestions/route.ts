import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

/**
 * GET /api/experiment/active-learning/suggestions
 *
 * Returns the user's candidates ranked by acquisitionScore — the
 * active-learning signal for which candidate to test next.
 *
 * Only candidates that have been through at least one feedback cycle
 * (acquisitionScore IS NOT NULL) are returned. Candidates already at
 * FED_BACK are excluded so the list always shows actionable next steps.
 *
 * Query params:
 *   limit  — max results to return (default 10, max 50)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limitParam = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)
  const limit = Math.min(isNaN(limitParam) || limitParam < 1 ? DEFAULT_LIMIT : limitParam, MAX_LIMIT)

  try {
    const candidates = await db.experimentCandidate.findMany({
      where: {
        userId: session.user.id,
        status: { not: "FED_BACK" },
        acquisitionScore: { not: null },
      },
      orderBy: { acquisitionScore: "desc" },
      take: limit,
      select: {
        id: true,
        displayName: true,
        kind: true,
        status: true,
        targetName: true,
        acquisitionScore: true,
        feedbackScore: true,
        uncertaintyScore: true,
        createdAt: true,
        feedbackRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { rationale: true, nResults: true, createdAt: true },
        },
      },
    })

    const suggestions = candidates.map((c) => ({
      candidateId: c.id,
      displayName: c.displayName,
      kind: c.kind,
      status: c.status,
      targetName: c.targetName,
      acquisitionScore: c.acquisitionScore,
      feedbackScore: c.feedbackScore,
      uncertaintyScore: c.uncertaintyScore,
      latestFeedback: (c.feedbackRuns as Array<{ rationale: string; nResults: number; createdAt: Date }>)[0] ?? null,
    }))

    return NextResponse.json({ suggestions, total: suggestions.length }, { status: 200 })
  } catch (err) {
    logger.error("Failed to fetch active-learning suggestions", { error: err })
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 })
  }
}
