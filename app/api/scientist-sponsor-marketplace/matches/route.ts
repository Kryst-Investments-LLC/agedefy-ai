import { NextResponse, type NextRequest } from "next/server"

import { getApiRequestUserId } from "@/lib/api-auth"
import { applyRateLimit } from "@/lib/rate-limit"
import { getMatchRecommendations } from "@/scientist-sponsor-marketplace/backend/controllers/matchingController"

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const userId = await getApiRequestUserId(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return getMatchRecommendations(request)
}
