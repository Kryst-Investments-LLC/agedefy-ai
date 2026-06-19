import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { CroWorkOrderStatus, type Prisma } from "@prisma/client"
import { z } from "zod"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import {
  canTransition,
  checkTransitionRequirements,
  type TransitionFacts,
} from "@/lib/cro/work-order-state"
import { summarizeValidationOutcome, type ValidationOutcomeSummary } from "@/lib/cro/validation-outcome"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

/**
 * POST /api/cro/work-orders/[id]/transition
 *
 * Advances a CRO work order along its lifecycle. Enforces both the legal
 * transition graph and the per-target data requirements:
 *   FUNDED        → escrowTransactionId present
 *   IN_PROGRESS   → submissionId (dispatched LabSubmission) present
 *   RECONCILED    → at least one reconciled CandidateLabResult exists
 *
 * The RECONCILED guard is the integrity rule that closes the loop honestly:
 * a work order can never be marked validated without real lab data.
 *
 * Role gate: RESEARCHER or ADMIN (order owner).
 */

const bodySchema = z.object({
  to: z.nativeEnum(CroWorkOrderStatus),
  note: z.string().max(2000).optional(),
  escrowTransactionId: z.string().min(1).optional(),
  submissionId: z.string().min(1).optional(),
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
      { error: "Forbidden: CRO transitions require RESEARCHER or ADMIN role" },
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
    const order = await db.croWorkOrder.findFirst({
      where: { id, userId: session.user.id },
      select: {
        id: true,
        status: true,
        candidateId: true,
        escrowTransactionId: true,
        submissionId: true,
      },
    })
    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const to = parsed.data.to

    // 1. Legal transition graph.
    if (!canTransition(order.status, to)) {
      return NextResponse.json(
        { error: `Illegal transition: ${order.status} → ${to}` },
        { status: 409 },
      )
    }

    // 2. Gather facts for the data-requirement guards.
    const nextEscrowId = parsed.data.escrowTransactionId ?? order.escrowTransactionId
    const nextSubmissionId = parsed.data.submissionId ?? order.submissionId

    // For loop closure, pull the candidate's reconciled lab-result flags so we
    // can both gate the transition and summarise the validation outcome.
    const reconciledResults =
      to === CroWorkOrderStatus.RECONCILED
        ? await db.candidateLabResult.findMany({
            where: { candidateId: order.candidateId },
            select: { flag: true },
          })
        : []

    const facts: TransitionFacts = {
      hasEscrow: Boolean(nextEscrowId),
      hasSubmission: Boolean(nextSubmissionId),
      reconciledResultCount: reconciledResults.length,
    }

    const requirement = checkTransitionRequirements(to, facts)
    if (!requirement.ok) {
      return NextResponse.json({ error: "Transition requirements not met", reason: requirement.reason }, { status: 422 })
    }

    // Loop closure: derive the validation outcome from real lab data.
    const validationOutcome: ValidationOutcomeSummary | null =
      to === CroWorkOrderStatus.RECONCILED ? summarizeValidationOutcome(reconciledResults) : null

    // 3. Apply.
    // On loop closure, record the validation outcome in the event note.
    const eventNote = validationOutcome
      ? `validation_outcome=${JSON.stringify(validationOutcome)}${parsed.data.note ? ` | ${parsed.data.note}` : ""}`
      : parsed.data.note ?? null

    const updateData: Prisma.CroWorkOrderUpdateInput = {
      status: to,
      statusEvents: {
        create: {
          fromStatus: order.status,
          toStatus: to,
          actorUserId: session.user.id,
          note: eventNote,
        },
      },
    }
    if (parsed.data.escrowTransactionId) updateData.escrowTransactionId = parsed.data.escrowTransactionId
    if (parsed.data.submissionId) updateData.submissionId = parsed.data.submissionId

    const updated = await db.croWorkOrder.update({
      where: { id: order.id },
      data: updateData,
      select: { id: true, status: true, escrowTransactionId: true, submissionId: true, updatedAt: true },
    })

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      action: "cro.work_order_transitioned",
      entityType: "CroWorkOrder",
      details: { workOrderId: order.id, fromStatus: order.status, toStatus: to, validationOutcome },
    })

    logger.info("CRO work order transitioned", {
      workOrderId: order.id,
      from: order.status,
      to,
      userId: session.user.id,
    })

    return NextResponse.json({ order: updated, validationOutcome })
  } catch (err) {
    logger.error("Failed to transition CRO work order", { error: err instanceof Error ? err.message : String(err), id })
    return NextResponse.json({ error: "Failed to transition work order" }, { status: 500 })
  }
}
