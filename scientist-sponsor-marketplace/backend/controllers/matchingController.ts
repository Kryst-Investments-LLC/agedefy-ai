import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { normalizeDiscovery, normalizeFundingRequest, normalizeSponsor } from "@/scientist-sponsor-marketplace/backend/models/normalizers"
import { rankDiscoveriesForSponsor } from "@/scientist-sponsor-marketplace/backend/matching/matchingEngine"
import { ensureSponsorProfile } from "@/scientist-sponsor-marketplace/backend/services/sponsorService"

export async function getMatchRecommendations(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sponsor = await ensureSponsorProfile({ id: session.user.id, name: session.user.name })
  const [discoveries, fundingRequests] = await Promise.all([
    db.marketplaceDiscovery.findMany({ where: { status: "PUBLISHED" }, orderBy: { scientificImpactScore: "desc" } }),
    db.marketplaceFundingRequest.findMany(),
  ])

  const category = request.nextUrl.searchParams.get("category") ?? undefined
  const maxCostCents = request.nextUrl.searchParams.get("maxCostCents")
  const minImpactScore = request.nextUrl.searchParams.get("minImpactScore")

  const ranked = rankDiscoveriesForSponsor({
    discoveries: discoveries.map(normalizeDiscovery).filter((item) => (category ? item.category === category : true)).filter((item) => (maxCostCents ? item.fundingGoalCents <= Number(maxCostCents) : true)).filter((item) => (minImpactScore ? item.scientificImpactScore >= Number(minImpactScore) : true)),
    sponsor: normalizeSponsor(sponsor),
    fundingRequests: fundingRequests.map(normalizeFundingRequest),
  })

  return NextResponse.json(ranked)
}
