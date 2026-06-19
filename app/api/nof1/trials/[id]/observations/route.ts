import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { type Prisma } from "@prisma/client"
import { z } from "zod"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { applyStopDecision, evaluateTrial } from "@/lib/agents/nof1"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

/**
 * POST /api/nof1/trials/[id]/observations
 *
 * Records new measurements into a running N-of-1 trial period, then runs the
 * pre-registered Bayesian stopping rule and auto-applies a stop decision if the
 * benefit/futility threshold is crossed.
 *
 * GUARDRAIL: this is a measurement + scheduling tool. The trial design, the
 * stopping rule, and ANY clinical action are the responsibility of the
 * supervising clinician/researcher who designed the pre-registered protocol.
 * The platform records data and evaluates the frozen analysis plan — it does
 * not prescribe, dose, or give medical advice.
 *
 * Role gate: RESEARCHER or ADMIN, and the trial owner.
 */

const FRAMING =
  "Research measurement against a pre-registered analysis plan. Not medical advice — the supervising clinician/researcher is responsible for any clinical action."

const observationSchema = z.object({
  measuredAt: z.string().datetime(),
  analyte: z.string().min(1).max(200),
  value: z.number(),
  unit: z.string().min(1).max(50),
})

const bodySchema = z.object({
  periodId: z.string().min(1),
  observations: z.array(observationSchema).min(1).max(200),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = session.user.role as string | undefined
  if (role !== "RESEARCHER" && role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden: N-of-1 observations require RESEARCHER or ADMIN role" },
      { status: 403 },
    )
  }

  const { id } = await params

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const trial = await db.nofOneTrial.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, status: true },
    })
    if (!trial) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (trial.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `Trial is not accepting observations (status: ${trial.status})` },
        { status: 409 },
      )
    }

    const period = await db.nofOnePeriod.findFirst({
      where: { id: parsed.data.periodId, trialId: id },
      select: { id: true, observations: true },
    })
    if (!period) {
      return NextResponse.json({ error: "Period not found for this trial" }, { status: 404 })
    }

    const existing = Array.isArray(period.observations) ? (period.observations as unknown[]) : []
    const merged = [...existing, ...parsed.data.observations]

    await db.nofOnePeriod.update({
      where: { id: period.id },
      data: { observations: merged as unknown as Prisma.InputJsonValue },
    })

    // Run the pre-registered stopping rule against the now-updated data, and
    // auto-apply a stop if a threshold is crossed. Wrapped so a stats failure
    // never loses the recorded observations.
    let decision = null
    try {
      decision = await evaluateTrial(id)
      if (decision && decision.decision !== "CONTINUE") {
        await applyStopDecision(id, decision, `Auto-stop: ${decision.decision} (pBenefit=${decision.pBenefit.toFixed(3)})`)
      }
    } catch (evalErr) {
      logger.error("N-of-1 stop evaluation failed (observations still recorded)", {
        trialId: id,
        error: evalErr instanceof Error ? evalErr.message : String(evalErr),
      })
    }

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      action: "nof1.observations_recorded",
      entityType: "NofOneTrial",
      entityId: id,
      details: JSON.stringify({
        periodId: period.id,
        added: parsed.data.observations.length,
        decision: decision?.decision ?? "NOT_EVALUATED",
      }),
    })

    return NextResponse.json({
      trialId: id,
      periodId: period.id,
      observationsAdded: parsed.data.observations.length,
      totalObservations: merged.length,
      decision,
      framing: FRAMING,
    })
  } catch (err) {
    logger.error("Failed to record N-of-1 observations", { trialId: id, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: "Failed to record observations" }, { status: 500 })
  }
}
