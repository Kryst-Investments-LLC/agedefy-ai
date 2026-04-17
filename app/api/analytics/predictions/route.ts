import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { predictBiomarker, type BiomarkerDataPoint } from "@/lib/analytics/biomarker-prediction"
import { authOptions } from "@/lib/auth"
import { requireGdprConsent } from "@/lib/consent"
import { db } from "@/lib/db"
import { applyRateLimit } from "@/lib/rate-limit"

/**
 * GET /api/analytics/predictions
 * Returns biomarker trend predictions for the authenticated user.
 * Requires at least 3 data points per biomarker to generate predictions.
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

  const biomarkers = await db.biomarker.findMany({
    where: { userId: session.user.id },
    orderBy: { measuredAt: "asc" },
    take: 2_000,
  })

  // Group biomarker entries by name
  const grouped = new Map<string, { unit: string; points: BiomarkerDataPoint[] }>()
  for (const entry of biomarkers) {
    const existing = grouped.get(entry.name)
    if (existing) {
      existing.points.push({ value: entry.value, measuredAt: entry.measuredAt })
    } else {
      grouped.set(entry.name, {
        unit: entry.unit,
        points: [{ value: entry.value, measuredAt: entry.measuredAt }],
      })
    }
  }

  const predictions = []
  for (const [name, data] of grouped) {
    const prediction = predictBiomarker(name, data.unit, data.points)
    if (prediction) {
      predictions.push(prediction)
    }
  }

  return NextResponse.json({
    predictions,
    generatedAt: new Date().toISOString(),
    minimumDataPoints: 3,
  })
}
