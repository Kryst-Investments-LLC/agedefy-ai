import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma, TrialMatchStatus } from "@prisma/client"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { trialMatchSchema } from "@/lib/validators/intelligence"

const validTrialMatchStatuses = new Set<TrialMatchStatus>([
  "CANDIDATE",
  "REVIEWED",
  "CONTACTED",
  "ENROLLED",
  "ARCHIVED",
])

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const matches = await db.trialMatch.findMany({
    where: { userId: session.user.id },
    include: {
      cohort: { select: { id: true, name: true, focusArea: true } },
      reviewEvents: true,
      reviewer: true,
    },
    orderBy: [{ matchScore: "desc" }, { createdAt: "desc" }],
    take: 100,
  })

  return NextResponse.json({ matches })
}

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 12, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = trialMatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, trialExternalId: parsed.data.trialExternalId, cohortId: parsed.data.cohortId }),
    execute: async () => {
      const match = await db.trialMatch.create({
        data: {
          userId: session.user.id,
          cohortId: parsed.data.cohortId,
          trialExternalId: parsed.data.trialExternalId,
          title: parsed.data.title,
          condition: parsed.data.condition,
          matchScore: parsed.data.matchScore,
          rationale: parsed.data.rationale,
          reviewerId: parsed.data.reviewerId ?? undefined,
          reviewNotes: parsed.data.reviewNotes ?? undefined,
          reviewEvents: parsed.data.reviewEvents
            ? {
                create: parsed.data.reviewEvents.map((event) => ({
                  actorUserId: event.reviewerId ?? parsed.data.reviewerId ?? session.user.id,
                  eventType: event.type,
                  notes: event.notes,
                  createdAt: new Date(event.timestamp),
                })),
              }
            : undefined,
        },
        include: { cohort: { select: { id: true, name: true, focusArea: true } }, reviewEvents: true, reviewer: true },
      })

      return { status: 201, body: match }
    },
  })
}

export async function PATCH(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 15, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const id = typeof body?.id === "string" ? body.id : null
  const assignedReviewerId = typeof body?.assignedReviewerId === "string"
    ? body.assignedReviewerId
    : typeof body?.reviewerId === "string"
      ? body.reviewerId
      : undefined
  const reviewNotes = typeof body?.reviewNotes === "string" ? body.reviewNotes : undefined
  const status = typeof body?.status === "string" && validTrialMatchStatuses.has(body.status as TrialMatchStatus)
    ? body.status as TrialMatchStatus
    : undefined
  const reviewEvent = body?.reviewEvent

  if (!id) {
    return NextResponse.json({ error: "Missing trial match id" }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, id, status, assignedReviewerId }),
    execute: async () => {
      const updateData: Prisma.TrialMatchUncheckedUpdateInput = {}
      if (assignedReviewerId !== undefined) updateData.reviewerId = assignedReviewerId || null
      if (reviewNotes !== undefined) updateData.reviewNotes = reviewNotes
      if (status !== undefined) updateData.status = status

      let reviewEventsUpdate:
        | Prisma.TrialMatchUpdateInput["reviewEvents"]
        | undefined

      if (reviewEvent && typeof reviewEvent === "object") {
        const event = reviewEvent as Record<string, unknown>
        reviewEventsUpdate = {
          create: [{
            actorUserId: typeof event.reviewerId === "string" ? event.reviewerId : session.user.id,
            eventType: typeof event.type === "string" ? event.type : "manual_review",
            notes: typeof event.notes === "string" ? event.notes : undefined,
            previousStatus: undefined,
            nextStatus: status,
            createdAt: typeof event.timestamp === "string" ? new Date(event.timestamp) : undefined,
          }],
        }
      }

      const updated = await db.trialMatch.update({
        where: { id },
        data: {
          ...updateData,
          ...(reviewEventsUpdate ? { reviewEvents: reviewEventsUpdate } : {}),
        },
        include: {
          cohort: { select: { id: true, name: true, focusArea: true } },
          reviewEvents: true,
          reviewer: true,
        },
      })

      return { status: 200, body: updated }
    },
  })
}