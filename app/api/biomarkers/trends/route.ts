import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { applyRateLimit } from "@/lib/rate-limit"

/**
 * GET /api/biomarkers/trends?name=<biomarkerName>&months=<n>
 *
 * Returns chronologically ordered measurements for a specific biomarker,
 * along with basic trend analytics (min, max, avg, delta, direction).
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const name = searchParams.get("name")
  const months = Math.min(Number(searchParams.get("months") ?? 12), 60)

  if (!name) {
    return NextResponse.json({ error: "Provide ?name=<biomarker name>" }, { status: 400 })
  }

  const since = new Date()
  since.setMonth(since.getMonth() - months)

  const measurements = await db.biomarker.findMany({
    where: {
      userId: session.user.id,
      name: { equals: name },
      measuredAt: { gte: since },
    },
    orderBy: { measuredAt: "asc" },
    take: 1_000,
    select: {
      id: true,
      value: true,
      unit: true,
      target: true,
      trend: true,
      measuredAt: true,
    },
  })

  if (measurements.length === 0) {
    return NextResponse.json({ name, measurements: [], analytics: null })
  }

  const values = measurements.map((m) => m.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const first = values[0]
  const last = values[values.length - 1]
  const delta = last - first
  const direction = delta > 0 ? "increasing" : delta < 0 ? "decreasing" : "stable"

  // Distinct biomarker names for this user (useful for autocomplete)
  const availableNames = await db.biomarker.findMany({
    where: { userId: session.user.id },
    distinct: ["name"],
    take: 500,
    select: { name: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({
    name,
    measurements,
    analytics: {
      count: values.length,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      avg: Math.round(avg * 100) / 100,
      delta: Math.round(delta * 100) / 100,
      direction,
      unit: measurements[0].unit,
      target: measurements[0].target,
    },
    availableNames: availableNames.map((n) => n.name),
  })
}
