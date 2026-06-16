import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { Prisma } from "@prisma/client"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import {
  computeAcquisitionScore,
  computeFeedbackScores,
} from "@/lib/active-learning/feedback-scorer"

/**
 * POST /api/experiment/candidates/[id]/feedback
 *
 * Trigger the active-learning feedback loop for a candidate that has logged
 * lab results. Reads all CandidateLabResults, computes feedbackScore /
 * uncertaintyScore / acquisitionScore, writes them to the candidate, records
 * a CandidateFeedbackRun audit row, and advances the status to FED_BACK.
 *
 * Allowed starting status: RESULT_LOGGED (idempotent: FED_BACK is a no-op).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const candidate = await db.experimentCandidate.findFirst({
      where: { id, userId: session.user.id },
      include: { labResults: true },
    })

    if (!candidate) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (candidate.status !== "RESULT_LOGGED" && candidate.status !== "FED_BACK") {
      return NextResponse.json(
        {
          error: "Candidate must be in RESULT_LOGGED status to trigger feedback",
          currentStatus: candidate.status,
        },
        { status: 422 },
      )
    }

    // Collect FED_BACK peers for the acquisition score comparison.
    const fedBackPeers = await db.experimentCandidate.findMany({
      where: { userId: session.user.id, status: "FED_BACK", NOT: { id } },
      select: { feedbackScore: true, screenJson: true },
    })

    const feedbackPeers = fedBackPeers
      .filter((p) => p.feedbackScore !== null)
      .map((p) => ({
        feedbackScore: p.feedbackScore as number,
        screenJson: p.screenJson as Record<string, unknown> | null,
      }))

    const labResults = (candidate.labResults as Array<{
      value: number
      unit: string
      operator: string
      flag: string | null
      assayType: string | null
    }>).map((r) => ({
      value: r.value,
      unit: r.unit,
      operator: r.operator,
      flag: r.flag,
      assayType: r.assayType,
    }))

    const scores = computeFeedbackScores(labResults)
    const acquisition = computeAcquisitionScore(
      candidate.screenJson as Record<string, unknown> | null,
      feedbackPeers,
    )

    const updated = await db.$transaction(async (tx) => {
      const updatedCandidate = await tx.experimentCandidate.update({
        where: { id },
        data: {
          feedbackScore: scores.feedbackScore,
          uncertaintyScore: scores.uncertaintyScore,
          acquisitionScore: acquisition.acquisitionScore,
          status: "FED_BACK",
        },
      })

      const feedbackRun = await tx.candidateFeedbackRun.create({
        data: {
          candidateId: id,
          userId: session.user.id,
          feedbackScore: scores.feedbackScore,
          uncertaintyScore: scores.uncertaintyScore,
          activityScore: scores.activityScore,
          selectivityScore: scores.selectivityScore,
          toxicityScore: scores.toxicityScore,
          nResults: scores.nResults,
          rationale: scores.rationale,
        },
      })

      if (candidate.status === "RESULT_LOGGED") {
        await tx.experimentCandidateEvent.create({
          data: {
            candidateId: id,
            actorUserId: session.user.id,
            fromStatus: "RESULT_LOGGED",
            toStatus: "FED_BACK",
            notes: `Active-learning feedback applied. ${scores.rationale}`,
            metadata: {
              feedbackScore: scores.feedbackScore,
              uncertaintyScore: scores.uncertaintyScore,
              acquisitionScore: acquisition.acquisitionScore,
            } as Prisma.InputJsonValue,
          },
        })
      }

      return { candidate: updatedCandidate, feedbackRun }
    })

    logger.info("Active-learning feedback applied", {
      candidateId: id,
      feedbackScore: scores.feedbackScore,
      acquisitionScore: acquisition.acquisitionScore,
      userId: session.user.id,
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (err) {
    logger.error("Failed to apply active-learning feedback", { error: err, id })
    return NextResponse.json({ error: "Failed to apply feedback" }, { status: 500 })
  }
}
