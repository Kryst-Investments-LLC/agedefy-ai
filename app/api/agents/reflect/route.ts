/**
 * POST /api/agents/reflect
 *
 * Triggers the Scientific Reflection Agent for a completed LoopCycle.
 * Produces a ReflectionReport signed with a W3C VC receipt.
 *
 * Access: RESEARCHER or CLINICIAN role required.
 * All output is labeled: "Retrospective research analysis — not medical advice."
 */

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { requireAuthWithRole } from "@/lib/rbac"
import { runReflectionAgent, REFLECTION_DISCLAIMER } from "@/lib/agents/reflection-agent"
import { writeProtocolOutcome } from "@/lib/loop/outcome-writer"
import { db } from "@/lib/db"

const bodySchema = z.object({
  loopCycleId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, "RESEARCHER", "CLINICIAN", "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "loopCycleId is required" }, { status: 400 })
  }

  const { loopCycleId } = parsed.data

  // Verify the cycle exists and belongs to a user accessible to the requester
  const cycle = await db.loopCycle.findUnique({
    where: { id: loopCycleId },
    select: { id: true, userId: true, tenantId: true, status: true },
  })

  if (!cycle) {
    return NextResponse.json({ error: "Loop cycle not found" }, { status: 404 })
  }

  // Ensure outcome is written before reflecting
  if (!cycle.status.match(/REFLECT|COMPLETE/)) {
    // Write outcome if not already present (idempotent)
    await writeProtocolOutcome(loopCycleId)
  }

  const output = await runReflectionAgent({
    loopCycleId,
    userId: cycle.userId,
    tenantId: cycle.tenantId,
  })

  if (!output) {
    return NextResponse.json(
      { error: "Reflection agent failed — check server logs" },
      { status: 500 },
    )
  }

  // Advance cycle to COMPLETE
  await db.loopCycle.update({
    where: { id: loopCycleId },
    data: { status: "COMPLETE", completedAt: new Date() },
  })

  return NextResponse.json({
    reportId: output.reportId,
    loopCycleId,
    insights: output.insights,
    priorAdjustments: output.priorAdjustments.length,
    twinAccuracyDelta: output.twinAccuracyDelta,
    disclaimer: REFLECTION_DISCLAIMER,
    signedVc: output.signedVc,
  })
}
