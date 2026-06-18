import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { assemblePilotMetrics } from "@/lib/active-learning/pilot-metrics"

const DEFAULT_WINDOW_DAYS = 90

/**
 * GET /api/experiment/pilot-metrics
 *
 * Computes and returns the four pilot metrics for the authenticated user:
 *   - hit-rate uplift (AL-guided vs. baseline FED_BACK candidates)
 *   - cost-per-validated-hit (from real marketplace transactions)
 *   - cycle time (from ExperimentCandidateEvent log)
 *   - false-positive / false-negative rates (screenJson QED vs. lab flags)
 *
 * Also persists a PilotMetricsSnapshot for trend tracking.
 *
 * Query params:
 *   windowDays — lookback window (default 90)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const windowDays = Math.max(
    1,
    parseInt(searchParams.get("windowDays") ?? String(DEFAULT_WINDOW_DAYS), 10) || DEFAULT_WINDOW_DAYS,
  )
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  try {
    // 1. FED_BACK candidates — used for hit-rate, cost, and cycle-time metrics.
    const fedBackCandidates = await db.experimentCandidate.findMany({
      where: {
        userId: session.user.id,
        status: "FED_BACK",
        createdAt: { gte: since },
      },
      select: {
        id: true,
        createdAt: true,
        status: true,
        acquisitionScore: true,
        feedbackScore: true,
        screenJson: true,
        labResults: { select: { flag: true } },
        events: { select: { fromStatus: true, toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
    })

    // 2. Candidates with both screenJson and lab results — used for FP/FN.
    const screenedWithLab = await db.experimentCandidate.findMany({
      where: {
        userId: session.user.id,
        status: { in: ["RESULT_LOGGED", "FED_BACK"] },
        screenJson: { not: null },
        createdAt: { gte: since },
        labResults: { some: {} },
      },
      select: {
        id: true,
        createdAt: true,
        status: true,
        acquisitionScore: true,
        feedbackScore: true,
        screenJson: true,
        labResults: { select: { flag: true } },
        events: { select: { fromStatus: true, toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
    })

    // 3. Marketplace transactions linked to candidates via MarketplaceDiscovery.candidateId.
    //    We pull discoveryId + candidateId from discoveries, then join transactions.
    const linkedDiscoveries = await db.marketplaceDiscovery.findMany({
      where: { candidateId: { not: null } },
      select: { id: true, candidateId: true },
    })

    const discoveryIdToCandidate = new Map(
      linkedDiscoveries.map((d) => [d.id, d.candidateId]),
    )

    const transactions =
      linkedDiscoveries.length > 0
        ? await db.marketplaceTransaction.findMany({
            where: {
              discoveryId: { in: linkedDiscoveries.map((d) => d.id) },
              status: { in: ["AUTHORIZED", "SETTLED"] },
            },
            select: { discoveryId: true, amountCents: true },
          })
        : []

    const linkedTransactions = transactions.map((t) => ({
      candidateId: discoveryIdToCandidate.get(t.discoveryId) ?? null,
      amountCents: t.amountCents,
    }))

    // 4. Assemble metrics from pure functions.
    const metrics = assemblePilotMetrics(
      fedBackCandidates.map((c) => ({
        ...c,
        screenJson: c.screenJson as Record<string, unknown> | null,
        events: c.events.map((e) => ({
          ...e,
          fromStatus: e.fromStatus ?? null,
        })),
      })),
      screenedWithLab.map((c) => ({
        ...c,
        screenJson: c.screenJson as Record<string, unknown> | null,
        events: c.events.map((e) => ({
          ...e,
          fromStatus: e.fromStatus ?? null,
        })),
      })),
      linkedTransactions,
    )

    // 5. Persist snapshot (fire-and-forget — don't block the response).
    db.pilotMetricsSnapshot
      .create({
        data: {
          userId: session.user.id,
          windowDays,
          alHitRate: metrics.hitRateUplift.alHitRate,
          baselineHitRate: metrics.hitRateUplift.baselineHitRate,
          hitRateUplift: metrics.hitRateUplift.uplift,
          alN: metrics.hitRateUplift.alN,
          baselineN: metrics.hitRateUplift.baselineN,
          totalSpendCents: metrics.cost.totalSpendCents,
          validatedHits: metrics.cost.validatedHits,
          costPerHitCents: metrics.cost.costPerHitCents,
          medianCycleTimeSec: metrics.cycleTime.medianCycleTimeSec,
          p75CycleTimeSec: metrics.cycleTime.p75CycleTimeSec,
          stageTimes: metrics.cycleTime.stageTimes,
          screenPositives: metrics.classification.screenPositives,
          screenNegatives: metrics.classification.screenNegatives,
          falsePositiveRate: metrics.classification.falsePositiveRate,
          falseNegativeRate: metrics.classification.falseNegativeRate,
        },
      })
      .catch((err) => logger.error("Failed to persist pilot metrics snapshot", { error: err }))

    return NextResponse.json({ ...metrics, windowDays }, { status: 200 })
  } catch (err) {
    logger.error("Failed to compute pilot metrics", { error: err })
    return NextResponse.json({ error: "Failed to compute pilot metrics" }, { status: 500 })
  }
}
