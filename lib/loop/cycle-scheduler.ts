/**
 * Protocol Cycle Scheduler — Tier 4.2
 *
 * Schedules REFLECT loop triggers at the end of each protocol cycle.
 * A protocol cycle is defined by `protocolCycleLengthDays` (default 28 days)
 * starting from `protocolCycleStartDate`.
 *
 * This module is called:
 *   1. When a protocol is created or activated → schedules the first reflection
 *   2. By the daily `cycle-sweep` cron → finds overdue cycles and triggers reflection
 *
 * The actual reflection is triggered via `triggerLoopCycle` with reason SCHEDULED.
 * The REFLECT job then runs `writeProtocolOutcome` → `runReflectionAgent`.
 */

import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { triggerLoopCycle } from "./loop-trigger"

/**
 * Schedule the first reflection for a protocol.
 * Called when a protocol is created or activated.
 * Sets `protocolCycleStartDate` to now if not already set.
 */
export async function scheduleNextReflection(protocolId: string): Promise<void> {
  try {
    const protocol = await db.protocol.findUnique({
      where: { id: protocolId },
      select: {
        id: true,
        userId: true,
        tenantId: true,
        protocolCycleStartDate: true,
        protocolCycleLengthDays: true,
        status: true,
      },
    })

    if (!protocol) {
      logger.warn("scheduleNextReflection: protocol not found", { protocolId })
      return
    }

    if (!["active", "ongoing"].includes(protocol.status)) return

    if (!protocol.protocolCycleStartDate) {
      await db.protocol.update({
        where: { id: protocolId },
        data: { protocolCycleStartDate: new Date() },
      })
    }

    logger.info("Cycle reflection scheduled", {
      protocolId,
      userId: protocol.userId,
      cycleLengthDays: protocol.protocolCycleLengthDays,
    })
  } catch (err) {
    logger.error("scheduleNextReflection failed", { protocolId, error: String(err) })
  }
}

/**
 * Daily sweep: find all protocols whose cycle end date has passed without
 * triggering a reflection, and fire a SCHEDULED loop cycle for each.
 *
 * Called by the `cycle-sweep` orchestration job.
 */
export async function sweepExpiredCycles(): Promise<{ triggered: number; errors: number }> {
  let triggered = 0
  let errors = 0

  try {
    const now = new Date()

    // Find active protocols whose cycle has ended (cycleStart + cycleLengthDays ≤ today)
    const protocols = await db.$queryRaw<
      Array<{ id: string; userId: string; tenantId: string; protocolCycleLengthDays: number; protocolCycleStartDate: Date }>
    >`
      SELECT
        p."id",
        p."userId",
        p."tenantId",
        p."protocolCycleLengthDays",
        p."protocolCycleStartDate"
      FROM "Protocol" p
      WHERE
        p."status" IN ('active', 'ongoing')
        AND p."protocolCycleStartDate" IS NOT NULL
        AND (p."protocolCycleStartDate" + (p."protocolCycleLengthDays" || ' days')::interval) <= ${now}
        AND NOT EXISTS (
          SELECT 1 FROM "LoopCycle" lc
          WHERE lc."userId" = p."userId"
            AND lc."triggeredBy" = 'SCHEDULED'
            AND lc."cycleStart" >= p."protocolCycleStartDate"
        )
    `

    logger.info("sweepExpiredCycles: found protocols", { count: protocols.length })

    for (const protocol of protocols) {
      try {
        await triggerLoopCycle({
          userId: protocol.userId,
          tenantId: protocol.tenantId ?? "default",
          reason: "SCHEDULED",
        })

        // Advance cycle start date for next cycle
        const nextCycleStart = new Date(protocol.protocolCycleStartDate)
        nextCycleStart.setDate(nextCycleStart.getDate() + protocol.protocolCycleLengthDays)

        await db.protocol.update({
          where: { id: protocol.id },
          data: { protocolCycleStartDate: nextCycleStart },
        })

        triggered++
        logger.info("Cycle sweep: triggered reflection", {
          protocolId: protocol.id,
          userId: protocol.userId,
          nextCycleStart,
        })
      } catch (err) {
        errors++
        logger.error("Cycle sweep: failed to trigger for protocol", {
          protocolId: protocol.id,
          error: String(err),
        })
      }
    }
  } catch (err) {
    logger.error("sweepExpiredCycles: query failed", { error: String(err) })
    errors++
  }

  return { triggered, errors }
}
