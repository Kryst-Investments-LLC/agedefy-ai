import { InteractionSeverity } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { adjustEvidenceScoreForReview, buildHypothesisScoreBreakdown, calculateContraindicationScore } from "@/lib/biomedical-intelligence"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { applyRateLimit } from "@/lib/rate-limit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { hypothesisSchema } from "@/lib/validators/intelligence"

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hypotheses = await db.hypothesis.findMany({
    where: { ownerUserId: session.user.id },
    include: {
      evidenceLinks: {
        include: {
          evidenceRecord: {
            select: { id: true, title: true, evidenceScore: true, studyType: true, evidenceDirection: true, reviewStatus: true },
          },
        },
      },
      priorityChanges: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          evidenceRecord: { select: { id: true, title: true } },
          evidenceReviewEvent: { select: { id: true, eventType: true, previousStatus: true, nextStatus: true, notes: true, createdAt: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { confidenceScore: "desc" }, { createdAt: "desc" }],
    take: 100,
  })

  return NextResponse.json({ hypotheses })
}

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 12, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = hypothesisSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, title: parsed.data.title, question: parsed.data.question }),
    execute: async () => {
      const evidenceRecords = parsed.data.evidenceRecordIds.length
    ? await db.evidenceRecord.findMany({
        where: { id: { in: parsed.data.evidenceRecordIds } },
        select: { id: true, evidenceScore: true, reviewStatus: true },
      })
    : []

  const compoundNames = parsed.data.suggestedInterventions
  const compounds = compoundNames.length
    ? await db.compound.findMany({
        where: { name: { in: compoundNames } },
        select: { id: true },
      })
    : []

  const interactions = compounds.length >= 2
    ? await db.compoundInteraction.findMany({
        where: {
          OR: [
            { compoundAId: { in: compounds.map((compound) => compound.id) }, compoundBId: { in: compounds.map((compound) => compound.id) } },
            { compoundBId: { in: compounds.map((compound) => compound.id) }, compoundAId: { in: compounds.map((compound) => compound.id) } },
          ],
        },
        select: { severity: true },
      })
    : []

  const contraindicationScore = calculateContraindicationScore(interactions.map((interaction) => interaction.severity as InteractionSeverity))
  const uncertaintyScore = parsed.data.uncertaintyScore ?? 0.5
  const scoreBreakdown = buildHypothesisScoreBreakdown({
    evidenceScores: evidenceRecords.map((record) => adjustEvidenceScoreForReview({ evidenceScore: record.evidenceScore, reviewStatus: record.reviewStatus })),
    contraindicationScore,
    uncertaintyScore,
  })

  const hypothesis = await db.hypothesis.create({
    data: {
      ownerUserId: session.user.id,
      title: parsed.data.title,
      question: parsed.data.question,
      targetCondition: parsed.data.targetCondition,
      rationale: parsed.data.rationale,
      proposedMechanism: parsed.data.proposedMechanism,
      suggestedTests: JSON.stringify(parsed.data.suggestedTests),
      suggestedInterventions: JSON.stringify(parsed.data.suggestedInterventions),
      cohortDefinition: parsed.data.cohortDefinition,
      priorityScore: scoreBreakdown.priorityScore,
      averageEvidenceScore: scoreBreakdown.averageEvidenceScore,
      evidenceCoverageScore: scoreBreakdown.evidenceCoverageScore,
      contraindicationScore: scoreBreakdown.contraindicationScore,
      confidenceScore: parsed.data.confidenceScore ?? scoreBreakdown.recommendedConfidenceScore,
      uncertaintyScore,
      status: scoreBreakdown.priorityScore >= 0.7 ? "PRIORITIZED" : "DRAFT",
      evidenceLinks: {
        create: evidenceRecords.map((record) => ({
          evidenceRecordId: record.id,
          weight: record.evidenceScore || 0.5,
        })),
      },
    },
    include: {
      evidenceLinks: {
        include: {
          evidenceRecord: {
            select: { id: true, title: true, evidenceScore: true, reviewStatus: true },
          },
        },
      },
      priorityChanges: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          evidenceRecord: { select: { id: true, title: true } },
          evidenceReviewEvent: { select: { id: true, eventType: true, previousStatus: true, nextStatus: true, notes: true, createdAt: true } },
        },
      },
    },
  })

  return { status: 201, body: { hypothesis, scoreBreakdown } }
    },
  })
}