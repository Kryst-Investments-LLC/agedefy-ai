/**
 * Federated Learning — Round Aggregation / Publish (admin)
 *
 * POST /api/fl/models/[id]/aggregate
 *
 * Aggregates the current round's participant contributions via FedAvg and, when
 * the minimum-client floor is met, publishes the model version with its
 * aggregated headline metrics and total DP epsilon. The min-client floor is both
 * a privacy floor and the network-effect gate — a model only improves (and only
 * publishes) once enough contributors have joined.
 *
 * Admin only. Feature-flagged behind ENABLE_FEDERATED_LEARNING.
 *
 * @module app/api/fl/models/[id]/aggregate/route
 */

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { logAudit } from "@/lib/audit"
import { applyRateLimit } from "@/lib/rate-limit"
import { aggregateRound, type Contribution } from "@/lib/fl/round-aggregation"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (env.ENABLE_FEDERATED_LEARNING !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  const { id } = await params

  try {
    const model = await db.federatedModel.findUnique({
      where: { id },
      select: { id: true, status: true, roundsCompleted: true },
    })
    if (!model) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 })
    }
    if (model.status !== "training") {
      return NextResponse.json({ error: "Model is not in training" }, { status: 409 })
    }

    const round = model.roundsCompleted
    const participations = await db.fLParticipation.findMany({
      where: { modelId: id, round, status: "completed" },
      select: { localSampleSize: true, localLoss: true, epsilonSpent: true },
    })

    const agg = aggregateRound(participations as Contribution[])

    if (!agg.ready) {
      return NextResponse.json(
        {
          error: "Not enough contributors to aggregate",
          contributors: agg.contributors,
          aggregate: agg,
        },
        { status: 409 },
      )
    }

    const published = await db.federatedModel.update({
      where: { id },
      data: {
        loss: agg.weightedLoss,
        accuracy: agg.weightedAccuracy,
        epsilon: agg.totalEpsilon,
        aggregatedFromN: agg.contributors,
        status: "published",
        publishedAt: new Date(),
      },
      select: { id: true, version: true, status: true, loss: true, accuracy: true, epsilon: true, aggregatedFromN: true, publishedAt: true },
    })

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      action: "fl.model.aggregated",
      entityType: "FederatedModel",
      entityId: id,
      details: JSON.stringify({ round, contributors: agg.contributors, totalEpsilon: agg.totalEpsilon }),
    })

    return NextResponse.json({ model: published, aggregate: agg })
  } catch (err) {
    return NextResponse.json(
      { error: "Aggregation failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
