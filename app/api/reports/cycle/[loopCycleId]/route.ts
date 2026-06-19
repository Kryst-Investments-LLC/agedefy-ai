/**
 * GET /api/reports/cycle/[loopCycleId]
 *
 * Returns the cycle report for a completed loop cycle.
 * Auth: the user themselves or a CLINICIAN/ADMIN.
 *
 * Response: JSON cycle report (CycleReport).
 * Future: PDF via Accept: application/pdf header.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

import { generateCycleReport, CYCLE_REPORT_DISCLAIMER } from "@/lib/reports/cycle-report"

export async function GET(
  _req: Request,
  { params }: { params: { loopCycleId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cycle = await db.loopCycle.findUnique({
    where: { id: params.loopCycleId },
    select: { userId: true, status: true },
  })

  if (!cycle) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isOwner = cycle.userId === session.user.id
  const isPrivileged = ["CLINICIAN", "ADMIN"].includes(session.user.role ?? "")

  if (!isOwner && !isPrivileged) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (cycle.status !== "COMPLETE") {
    return NextResponse.json(
      {
        error: "Cycle not yet complete",
        status: cycle.status,
        message: "Reports are only available for completed cycles.",
      },
      { status: 422 },
    )
  }

  try {
    const report = await generateCycleReport(params.loopCycleId)

    if (!report) {
      return NextResponse.json({ error: "Failed to generate report" }, { status: 500 })
    }

    return NextResponse.json({
      disclaimer: CYCLE_REPORT_DISCLAIMER,
      report,
    })
  } catch (err) {
    logger.error("GET /api/reports/cycle/[id] failed", {
      loopCycleId: params.loopCycleId, error: String(err),
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
