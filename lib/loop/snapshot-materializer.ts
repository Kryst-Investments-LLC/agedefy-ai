import { db } from "@/lib/db"
import { identifyDysregulatedPathways } from "./pathway-state"

/**
 * Materializes a PhysiologicalSnapshot for the given user.
 *
 * Reads the current state from: latest biomarkers, active protocol,
 * digital twin metadata, and most recent twin simulation. The result is
 * persisted to the DB and returned for the OBSERVE stage to consume.
 *
 * Never throws — on any DB error, returns null so the caller can decide
 * whether to fail the loop cycle or continue with a degraded snapshot.
 */
export async function materializeSnapshot(
  userId: string,
  tenantId: string,
): Promise<{ id: string } | null> {
  try {
    const [rawBiomarkers, activeProtocol, twin, latestSim] = await Promise.all([
      // Most recent value per biomarker name
      db.biomarker.findMany({
        where: { userId },
        orderBy: { measuredAt: "desc" },
        select: { name: true, value: true, unit: true, trend: true, measuredAt: true },
      }),
      // Prefer an 'active' protocol; fall back to most recently updated
      db.protocol.findFirst({
        where: { userId, status: { in: ["active", "ongoing"] } },
        orderBy: { updatedAt: "desc" },
        select: { id: true, createdAt: true, status: true },
      }),
      // User's physiological twin — unique per user
      db.physiologicalTwin.findUnique({
        where: { userId },
        select: { updatedAt: true },
      }),
      // Latest simulation across all endpoints
      db.twinSimulationRun.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, predictedMean: true, endpoint: true },
      }),
    ])

    // Deduplicate biomarkers — keep only the latest reading per name
    const latest = new Map<string, { value: number; unit: string; trend: string; measuredAt: Date }>()
    for (const b of rawBiomarkers) {
      if (!latest.has(b.name)) {
        latest.set(b.name, { value: b.value, unit: b.unit, trend: b.trend, measuredAt: b.measuredAt })
      }
    }

    // Build the biomarkersJson shape
    const biomarkersJson: Record<string, { value: number; unit: string; trend: string; lastUpdated: string }> = {}
    for (const [name, reading] of latest.entries()) {
      biomarkersJson[name] = {
        value: reading.value,
        unit: reading.unit,
        trend: reading.trend,
        lastUpdated: reading.measuredAt.toISOString(),
      }
    }

    // Pathway classifier (deterministic, no LLM)
    const pathways = identifyDysregulatedPathways(
      Object.fromEntries(
        [...latest.entries()].map(([name, r]) => [name, { value: r.value, unit: r.unit }]),
      ),
    )

    // Protocol adherence
    let protocolWeeksActive: number | null = null
    if (activeProtocol) {
      const msActive = Date.now() - activeProtocol.createdAt.getTime()
      protocolWeeksActive = Math.max(0, msActive / (1000 * 60 * 60 * 24 * 7))
    }

    const snapshot = await db.physiologicalSnapshot.create({
      data: {
        userId,
        tenantId,
        biomarkersJson,
        activeProtocolId: activeProtocol?.id ?? null,
        protocolWeeksActive,
        dysregulatedPathways: pathways.map((p) => p.name),
        twinLastSimAt: latestSim?.createdAt ?? twin?.updatedAt ?? null,
      },
      select: { id: true },
    })

    return snapshot
  } catch {
    return null
  }
}
