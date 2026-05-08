import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { runPubMedContentPipeline } from "@/lib/content-pipeline"
import { applyRateLimit } from "@/lib/rate-limit"

/**
 * POST /api/admin/content-pipeline
 * Triggers bulk PubMed article import into the Learning Center.
 * Admin only. Supports dry-run mode.
 *
 * Body: { dryRun?: boolean, published?: boolean }
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 2, windowMs: 300_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const dryRun = body.dryRun === true
  const published = body.published === true

  try {
    const result = await runPubMedContentPipeline({
      authorUserId: session.user.id,
      published,
      dryRun,
    })

    return NextResponse.json({
      message: dryRun
        ? `Dry run complete. Would import ${result.totalImported} articles.`
        : `Imported ${result.totalImported} articles into Learning Center.`,
      ...result,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pipeline failed" },
      { status: 500 }
    )
  }
}
