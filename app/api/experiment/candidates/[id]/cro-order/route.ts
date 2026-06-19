import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { CroWorkOrderStatus, type Prisma } from "@prisma/client"
import { z } from "zod"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { evaluateCroEligibility } from "@/lib/cro/funnel"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

/**
 * POST /api/experiment/candidates/[id]/cro-order
 *
 * Creates a CRO work order (DRAFT) routing a FEP-triage-recommended candidate to
 * a partner CRO for physical validation. The candidate must have cleared the FEP
 * cost-triage gate (fepGateScore ≥ recommend threshold) — this is the funnel
 * that keeps expensive lab spend pointed only at recommended candidates.
 *
 * Role gate: RESEARCHER or ADMIN. The order starts in DRAFT and is advanced
 * through its lifecycle via the work-order transition endpoint.
 */

const bodySchema = z.object({
  croPartnerId: z.string().min(1),
  assayType: z.enum(["biochemical", "cellular", "animal"]),
  requestedAssays: z.array(z.object({ name: z.string().min(1) }).passthrough()).min(1).max(50),
  milestonePlan: z
    .array(z.object({ name: z.string().min(1), amountCents: z.number().int().min(0) }))
    .max(20)
    .optional(),
  quoteCents: z.number().int().min(0).optional(),
  notes: z.string().max(5000).optional(),
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
      { error: "Forbidden: CRO orders require RESEARCHER or ADMIN role" },
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
    const candidate = await db.experimentCandidate.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, fepGateScore: true, displayName: true },
    })
    if (!candidate) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Funnel gate: only triage-recommended candidates may enter CRO validation.
    const eligibility = evaluateCroEligibility(candidate.fepGateScore)
    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: "Candidate not eligible for CRO validation", reason: eligibility.reason },
        { status: 422 },
      )
    }

    const partner = await db.croPartner.findFirst({
      where: { id: parsed.data.croPartnerId, status: "active" },
      select: { id: true, name: true },
    })
    if (!partner) {
      return NextResponse.json({ error: "CRO partner not found or inactive" }, { status: 404 })
    }

    const order = await db.croWorkOrder.create({
      data: {
        candidateId: candidate.id,
        userId: session.user.id,
        croPartnerId: partner.id,
        assayType: parsed.data.assayType,
        requestedAssays: parsed.data.requestedAssays as unknown as Prisma.InputJsonValue,
        milestonePlan: (parsed.data.milestonePlan ?? []) as unknown as Prisma.InputJsonValue,
        quoteCents: parsed.data.quoteCents ?? null,
        fepGateScoreAtOrder: candidate.fepGateScore,
        notes: parsed.data.notes ?? null,
        status: CroWorkOrderStatus.DRAFT,
        statusEvents: {
          create: { toStatus: CroWorkOrderStatus.DRAFT, actorUserId: session.user.id, note: "Work order created" },
        },
      },
      select: {
        id: true,
        status: true,
        candidateId: true,
        croPartnerId: true,
        assayType: true,
        fepGateScoreAtOrder: true,
        createdAt: true,
      },
    })

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      action: "cro.work_order_created",
      entityType: "CroWorkOrder",
      details: {
        workOrderId: order.id,
        candidateId: candidate.id,
        croPartnerId: partner.id,
        assayType: parsed.data.assayType,
        fepGateScoreAtOrder: candidate.fepGateScore,
      },
    })

    logger.info("CRO work order created", {
      workOrderId: order.id,
      candidateId: candidate.id,
      userId: session.user.id,
    })

    return NextResponse.json({ order, eligibility }, { status: 201 })
  } catch (err) {
    logger.error("Failed to create CRO work order", { error: err instanceof Error ? err.message : String(err), id })
    return NextResponse.json({ error: "Failed to create CRO work order" }, { status: 500 })
  }
}
