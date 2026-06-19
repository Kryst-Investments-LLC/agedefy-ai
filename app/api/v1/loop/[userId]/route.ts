/**
 * GET /api/v1/loop/:userId
 *
 * Returns the current self-improving loop status for the given user:
 *   - The active LoopCycle (if any), with its current stage
 *   - The most recent completed cycle
 *   - The latest PhysiologicalSnapshot (dysregulated pathways, biomarker count)
 *   - Aggregate counts (total cycles, completed, failed)
 *
 * Access: session required; callers may only query their own userId.
 * Admins are not special-cased here — add a separate admin-scoped route if needed.
 */

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { userId } = await params

  if (session.user.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [activeCycle, lastCompletedCycle, latestSnapshot, counts] = await Promise.all([
    db.loopCycle.findFirst({
      where: { userId, status: { in: ["OBSERVE", "PLAN", "ACT", "REFLECT"] } },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        status: true,
        triggeredBy: true,
        startedAt: true,
        snapshotId: true,
      },
    }),
    db.loopCycle.findFirst({
      where: { userId, status: "COMPLETE" },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        status: true,
        triggeredBy: true,
        startedAt: true,
        completedAt: true,
      },
    }),
    db.physiologicalSnapshot.findFirst({
      where: { userId },
      orderBy: { materializedAt: "desc" },
      select: {
        id: true,
        materializedAt: true,
        dysregulatedPathways: true,
        activeProtocolId: true,
        protocolWeeksActive: true,
        biomarkersJson: true,
      },
    }),
    db.loopCycle.groupBy({
      by: ["status"],
      where: { userId },
      _count: { id: true },
    }),
  ])

  const countByStatus = Object.fromEntries(counts.map((c) => [c.status, c._count.id]))
  const totalCycles = Object.values(countByStatus).reduce((a: number, b: number) => a + b, 0)

  const snapshotSummary = latestSnapshot
    ? {
        id: latestSnapshot.id,
        materializedAt: latestSnapshot.materializedAt,
        dysregulatedPathways: latestSnapshot.dysregulatedPathways,
        activeProtocolId: latestSnapshot.activeProtocolId,
        protocolWeeksActive: latestSnapshot.protocolWeeksActive,
        biomarkerCount: Object.keys(
          (latestSnapshot.biomarkersJson as Record<string, unknown>) ?? {},
        ).length,
      }
    : null

  return NextResponse.json({
    userId,
    activeCycle,
    lastCompletedCycle,
    latestSnapshot: snapshotSummary,
    stats: {
      total: totalCycles,
      byStatus: countByStatus,
    },
  })
}
