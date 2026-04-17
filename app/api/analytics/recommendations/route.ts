import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { generateRecommendations } from "@/lib/analytics/recommendations"
import { authOptions } from "@/lib/auth"
import { requireGdprConsent } from "@/lib/consent"
import { db } from "@/lib/db"
import { applyRateLimit } from "@/lib/rate-limit"

/**
 * GET /api/analytics/recommendations
 * Returns personalized recommendations based on the user's biomarkers,
 * the knowledge graph (compounds → pathways), and available lab panels.
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const consentBlocked = await requireGdprConsent(session.user.id, ['ai-health-info', 'data-processing'])
  if (consentBlocked) return consentBlocked

  const [biomarkers, compoundPathways, labPanels] = await Promise.all([
    db.biomarker.findMany({
      where: { userId: session.user.id },
      orderBy: { measuredAt: "desc" },
      distinct: ["name"],
      select: { name: true, value: true, unit: true, target: true, trend: true },
    }),
    db.compoundPathway.findMany({
      include: {
        compound: { select: { id: true, name: true, mechanism: true } },
        pathway: { select: { id: true, name: true, category: true } },
      },
      take: 200,
    }),
    db.labTestPanel.findMany({
      select: { id: true, name: true, description: true, biomarkers: true },
      take: 50,
    }),
  ])

  const recommendations = generateRecommendations({
    biomarkers: biomarkers.map((b) => ({
      name: b.name,
      value: b.value,
      unit: b.unit,
      target: b.target,
      trend: b.trend,
    })),
    compoundPathways,
    labPanels,
  })

  return NextResponse.json({
    recommendations,
    generatedAt: new Date().toISOString(),
    biomarkerCount: biomarkers.length,
  })
}
