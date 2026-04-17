import type { NextRequest } from "next/server"

import { getMatchRecommendations } from "@/scientist-sponsor-marketplace/backend/controllers/matchingController"

export async function GET(request: NextRequest) {
  return getMatchRecommendations(request)
}
