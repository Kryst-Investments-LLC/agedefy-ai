/**
 * POST /api/agents/plan
 *
 * Preview the adaptive InvestigationPlan the ClinicalPlanningAgent would
 * generate for the requesting user's current physiological state.
 *
 * RESEARCHER / CLINICIAN / ADMIN only.
 * This is a read-only preview endpoint — it does NOT persist a session or
 * trigger any agents. Callers can use this to understand why a given cycle
 * chose a particular agent sequence.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { requireAuthWithRole } from "@/lib/middleware/auth-role"

import { runClinicalPlanningAgent, PLAN_DISCLAIMER } from "@/lib/agents/clinical-planning-agent"

const bodySchema = z.object({
  userId: z.string().min(1),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  const authError = requireAuthWithRole(session, "RESEARCHER", "CLINICIAN", "ADMIN")
  if (authError instanceof NextResponse) return authError

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  const callerId = session!.user.id
  const targetUserId = body.userId

  // Callers can only preview their own plan unless ADMIN
  if (targetUserId !== callerId && session!.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const snapshot = await db.physiologicalSnapshot.findFirst({
      where: { userId: targetUserId },
      orderBy: { materializedAt: "desc" },
      select: {
        id: true,
        materializedAt: true,
        dysregulatedPathways: true,
        activeProtocolId: true,
        protocolWeeksActive: true,
        biomarkersJson: true,
      },
    })

    if (!snapshot) {
      return NextResponse.json(
        {
          disclaimer: PLAN_DISCLAIMER,
          plan: null,
          message:
            "No physiological snapshot found. Ingest biomarkers to generate an adaptive plan.",
        },
        { status: 200 },
      )
    }

    const recentReflections = await db.reflectionReport.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { insights: true, twinAccuracyDelta: true },
    })

    const investigationPlan = await runClinicalPlanningAgent(
      snapshot as Parameters<typeof runClinicalPlanningAgent>[0],
      recentReflections as Array<{ insights?: string[]; twinAccuracyDelta?: number | null }>,
    )

    logger.info("InvestigationPlan preview generated", {
      userId: targetUserId,
      requestedBy: callerId,
      pathways: investigationPlan.priorityPathways,
      agents: investigationPlan.agentSequence.map((s) => s.agentClass),
    })

    return NextResponse.json({
      disclaimer: PLAN_DISCLAIMER,
      snapshotId: snapshot.id,
      snapshotAt: snapshot.materializedAt,
      plan: investigationPlan,
    })
  } catch (err) {
    logger.error("POST /api/agents/plan failed", { userId: targetUserId, error: String(err) })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
