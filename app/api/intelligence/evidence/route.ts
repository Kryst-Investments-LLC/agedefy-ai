import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { UserRole } from "@prisma/client"

import { authOptions } from "@/lib/auth"
import { adjustEvidenceScoreForReview, buildHypothesisScoreBreakdown, calculateEvidenceScore, estimateReviewConfidence } from "@/lib/biomedical-intelligence"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { evidenceRecordSchema, evidenceReviewSchema } from "@/lib/validators/intelligence"

const privilegedReviewerRoles = new Set<UserRole>(["ADMIN", "CLINICIAN", "RESEARCHER"])

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const diseaseArea = searchParams.get("diseaseArea") ?? undefined

  const evidence = await db.evidenceRecord.findMany({
    where: {
      ...(diseaseArea ? { diseaseArea: { contains: diseaseArea } } : {}),
      OR: [
        { createdByUserId: session.user.id },
        { reviewed: true },
      ],
    },
    orderBy: [{ reviewed: "desc" }, { evidenceScore: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      reviewedByUser: { select: { id: true, email: true, name: true } },
      assignedReviewer: { select: { id: true, email: true, name: true, role: true } },
      reviewEvents: {
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      researchEntry: { select: { id: true, title: true, source: true, externalId: true } },
    },
  })

  return NextResponse.json({ evidence })
}

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 15, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = evidenceRecordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, title: parsed.data.title, sourceLabel: parsed.data.sourceLabel, externalId: parsed.data.externalId }),
    execute: async () => {
      const evidenceScore = calculateEvidenceScore({
        studyType: parsed.data.studyType,
        evidenceDirection: parsed.data.evidenceDirection,
        uncertaintyScore: parsed.data.uncertaintyScore,
      })

      const evidence = await db.evidenceRecord.create({
        data: {
          createdByUserId: session.user.id,
          researchEntryId: parsed.data.researchEntryId,
          title: parsed.data.title,
          diseaseArea: parsed.data.diseaseArea,
          sourceLabel: parsed.data.sourceLabel,
          externalId: parsed.data.externalId,
          sourceUrl: parsed.data.sourceUrl,
          abstract: parsed.data.abstract,
          populationSummary: parsed.data.populationSummary,
          interventionSummary: parsed.data.interventionSummary,
          outcomeSummary: parsed.data.outcomeSummary,
          biomarkerTargets: JSON.stringify(parsed.data.biomarkerTargets),
          contraindications: JSON.stringify(parsed.data.contraindications),
          studyType: parsed.data.studyType,
          evidenceDirection: parsed.data.evidenceDirection,
          reviewStatus: "IN_REVIEW",
          assignedReviewerId: privilegedReviewerRoles.has(session.user.role) ? session.user.id : undefined,
          provenanceType: "MANUAL",
          provenanceDetail: "User-submitted evidence awaiting human verification.",
          uncertaintyScore: parsed.data.uncertaintyScore ?? 0.5,
          reviewConfidence: estimateReviewConfidence({
            evidenceScore,
            uncertaintyScore: parsed.data.uncertaintyScore ?? 0.5,
            hasAbstract: Boolean(parsed.data.abstract),
          }),
          sourceCapturedAt: new Date(),
          evidenceScore,
        },
      })

      return { status: 201, body: evidence }
    },
  })
}

export async function PATCH(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!privilegedReviewerRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = evidenceReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, id: parsed.data.id, reviewStatus: parsed.data.reviewStatus, assignedReviewerId: parsed.data.assignedReviewerId }),
    execute: async () => {
      const existing = await db.evidenceRecord.findFirst({
        where: {
          id: parsed.data.id,
        },
        select: {
          id: true,
          assignedReviewerId: true,
      reviewStatus: true,
      verificationNotes: true,
      evidenceScore: true,
      uncertaintyScore: true,
      abstract: true,
      hypotheses: {
        include: {
          hypothesis: {
            select: {
              id: true,
              priorityScore: true,
              status: true,
              confidenceScore: true,
              uncertaintyScore: true,
              contraindicationScore: true,
              evidenceLinks: {
                include: {
                  evidenceRecord: { select: { id: true, title: true, evidenceScore: true, reviewStatus: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!existing) {
    return NextResponse.json({ error: "Evidence record not found" }, { status: 404 })
  }

  const nextAssignedReviewerId = parsed.data.assignedReviewerId ?? existing.assignedReviewerId
  const nextReviewStatus = parsed.data.reviewStatus ?? existing.reviewStatus

  if (parsed.data.assignedReviewerId) {
    const reviewer = await db.user.findUnique({
      where: { id: parsed.data.assignedReviewerId },
      select: { id: true, role: true },
    })

    if (!reviewer || !privilegedReviewerRoles.has(reviewer.role)) {
      return NextResponse.json({ error: "Assigned reviewer must have reviewer privileges" }, { status: 400 })
    }
  }

  if (
    (nextReviewStatus === "VERIFIED" || nextReviewStatus === "REJECTED" || nextReviewStatus === "ESCALATED")
    && session.user.role !== "ADMIN"
    && nextAssignedReviewerId !== session.user.id
  ) {
    return NextResponse.json({ error: "Only the assigned reviewer or an admin can finalize evidence review" }, { status: 403 })
  }

  const isResolved = nextReviewStatus === "VERIFIED" || nextReviewStatus === "REJECTED"
  const evidence = await db.evidenceRecord.update({
    where: { id: existing.id },
    data: {
      reviewedByUserId: session.user.id,
      assignedReviewerId: nextAssignedReviewerId,
      reviewStatus: nextReviewStatus,
      verificationNotes: parsed.data.verificationNotes ?? existing.verificationNotes,
      reviewConfidence: parsed.data.reviewConfidence ?? estimateReviewConfidence({
        evidenceScore: existing.evidenceScore,
        uncertaintyScore: existing.uncertaintyScore,
        hasAbstract: Boolean(existing.abstract),
      }),
      reviewed: nextReviewStatus === "VERIFIED",
      reviewedAt: isResolved ? new Date() : null,
    },
    include: {
      reviewedByUser: { select: { id: true, email: true, name: true } },
      assignedReviewer: { select: { id: true, email: true, name: true, role: true } },
      reviewEvents: {
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      researchEntry: { select: { id: true, title: true, source: true, externalId: true } },
    },
  })

  const eventType = parsed.data.assignedReviewerId && parsed.data.assignedReviewerId !== existing.assignedReviewerId
    ? "ASSIGNED"
    : parsed.data.reviewStatus && parsed.data.reviewStatus !== existing.reviewStatus
      ? "STATUS_UPDATED"
      : "NOTES_UPDATED"

  const reviewEvent = await db.evidenceReviewEvent.create({
    data: {
      evidenceRecordId: existing.id,
      actorUserId: session.user.id,
      eventType,
      previousStatus: existing.reviewStatus,
      nextStatus: nextReviewStatus,
      previousAssignedReviewerId: existing.assignedReviewerId,
      nextAssignedReviewerId,
      notes: parsed.data.verificationNotes,
    },
  })

  for (const linked of existing.hypotheses) {
    const hypothesis = linked.hypothesis
    const adjustedScores = hypothesis.evidenceLinks.map((evidenceLink) => adjustEvidenceScoreForReview({
      evidenceScore: evidenceLink.evidenceRecord.evidenceScore,
      reviewStatus: evidenceLink.evidenceRecord.id === existing.id ? nextReviewStatus : evidenceLink.evidenceRecord.reviewStatus,
    }))
    const scoreBreakdown = buildHypothesisScoreBreakdown({
      evidenceScores: adjustedScores,
      contraindicationScore: hypothesis.contraindicationScore,
      uncertaintyScore: hypothesis.uncertaintyScore,
    })
    const nextHypothesisStatus = scoreBreakdown.priorityScore >= 0.7 ? "PRIORITIZED" : "DRAFT"

    await db.hypothesis.update({
      where: { id: hypothesis.id },
      data: {
        priorityScore: scoreBreakdown.priorityScore,
        averageEvidenceScore: scoreBreakdown.averageEvidenceScore,
        evidenceCoverageScore: scoreBreakdown.evidenceCoverageScore,
        confidenceScore: scoreBreakdown.recommendedConfidenceScore,
        status: nextHypothesisStatus,
      },
    })

    await db.hypothesisPriorityChange.create({
      data: {
        hypothesisId: hypothesis.id,
        evidenceReviewEventId: reviewEvent.id,
        evidenceRecordId: existing.id,
        previousPriorityScore: hypothesis.priorityScore,
        newPriorityScore: scoreBreakdown.priorityScore,
        previousConfidenceScore: hypothesis.confidenceScore,
        newConfidenceScore: scoreBreakdown.recommendedConfidenceScore,
        previousStatus: hypothesis.status,
        newStatus: nextHypothesisStatus,
        delta: Number((scoreBreakdown.priorityScore - hypothesis.priorityScore).toFixed(3)),
        rationale: `Evidence review changed from ${existing.reviewStatus} to ${nextReviewStatus}.`,
      },
    })
  }

  return { status: 200, body: { evidence } }
    },
  })
}