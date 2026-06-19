import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

export interface TargetBiomarker {
  name: string
  predictedDelta: number
  predictedDirection: "up" | "down" | "stable"
}

export interface ObservedBiomarker {
  name: string
  observedDelta: number
  observedDirection: "up" | "down" | "stable"
  confidence: number
}

export interface ProtocolOutcomeResult {
  id: string
  loopCycleId: string
  observedBiomarkers: ObservedBiomarker[]
  overallEfficacy: number | null
}

/**
 * Writes a ProtocolOutcome for the given loop cycle.
 *
 * Computes per-biomarker deltas by comparing observations collected after
 * cycle start against the most recent reading from before it. Protocol
 * predictions are empty for now (Tier 3 fills them when the planning agent
 * can emit structured predictions).
 *
 * Never throws — returns null on DB or computation error.
 */
export async function writeProtocolOutcome(
  loopCycleId: string,
): Promise<ProtocolOutcomeResult | null> {
  try {
    const cycle = await db.loopCycle.findUnique({
      where: { id: loopCycleId },
      select: {
        id: true,
        userId: true,
        tenantId: true,
        startedAt: true,
        snapshot: { select: { activeProtocolId: true } },
        protocolOutcome: { select: { id: true } },
      },
    })

    if (!cycle) {
      logger.warn("writeProtocolOutcome: cycle not found", { loopCycleId })
      return null
    }

    // Skip if already written
    if (cycle.protocolOutcome) {
      return {
        id: cycle.protocolOutcome.id,
        loopCycleId,
        observedBiomarkers: [],
        overallEfficacy: null,
      }
    }

    const cycleStart = cycle.startedAt
    const protocolId = cycle.snapshot?.activeProtocolId ?? null

    // All distinct biomarker names measured after cycle start
    const afterReadings = await db.biomarker.findMany({
      where: { userId: cycle.userId, measuredAt: { gte: cycleStart } },
      orderBy: { measuredAt: "asc" },
      select: { name: true, value: true, measuredAt: true },
    })

    // Latest reading before cycle start per biomarker name (for delta)
    const biomarkerNames = [...new Set(afterReadings.map((r) => r.name))]
    const beforeReadings =
      biomarkerNames.length > 0
        ? await db.biomarker.findMany({
            where: {
              userId: cycle.userId,
              measuredAt: { lt: cycleStart },
              name: { in: biomarkerNames },
            },
            orderBy: { measuredAt: "desc" },
            select: { name: true, value: true },
          })
        : []

    // Latest "before" value per name
    const beforeMap = new Map<string, number>()
    for (const r of beforeReadings) {
      if (!beforeMap.has(r.name)) beforeMap.set(r.name, r.value)
    }

    // Latest "after" value per name
    const afterMap = new Map<string, number>()
    for (const r of afterReadings) {
      afterMap.set(r.name, r.value)
    }

    const observedBiomarkers: ObservedBiomarker[] = []
    for (const name of biomarkerNames) {
      const before = beforeMap.get(name)
      const after = afterMap.get(name)
      if (before === undefined || after === undefined) continue
      const delta = after - before
      const direction: "up" | "down" | "stable" =
        Math.abs(delta) < 0.001 * Math.abs(before || 1)
          ? "stable"
          : delta > 0
            ? "up"
            : "down"
      observedBiomarkers.push({
        name,
        observedDelta: delta,
        observedDirection: direction,
        // Confidence based on magnitude vs baseline (heuristic — replaced by twin scorer in Tier 2.3)
        confidence: Math.min(1, Math.abs(delta) / (Math.abs(before) * 0.5 + 0.001)),
      })
    }

    const outcome = await db.protocolOutcome.create({
      data: {
        userId: cycle.userId,
        tenantId: cycle.tenantId,
        loopCycleId,
        protocolId,
        cycleStartDate: cycleStart,
        cycleEndDate: new Date(),
        observedBiomarkers,
      },
      select: { id: true },
    })

    logger.info("Protocol outcome written", {
      outcomeId: outcome.id,
      loopCycleId,
      biomarkersObserved: observedBiomarkers.length,
    })

    return {
      id: outcome.id,
      loopCycleId,
      observedBiomarkers,
      overallEfficacy: null,
    }
  } catch (err) {
    logger.error("writeProtocolOutcome failed", { loopCycleId, error: String(err) })
    return null
  }
}
