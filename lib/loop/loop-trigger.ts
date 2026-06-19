import type { LoopTriggerReason } from "@prisma/client"

import { db } from "@/lib/db"
import { enqueueOrchestrationJob } from "@/lib/jobs/queue"
import { logger } from "@/lib/logger"

export type { LoopTriggerReason }

export interface TriggerLoopCycleInput {
  userId: string
  tenantId: string
  reason: LoopTriggerReason
}

/**
 * Creates a LoopCycle row in OBSERVE state and enqueues a `loop.observe` job.
 *
 * Idempotent within a 5-minute window per user — duplicate signals from the
 * same ingest burst collapse into a single cycle rather than triggering a flood.
 *
 * Fire-and-forget: callers should call this without await and attach `.catch()`.
 */
export async function triggerLoopCycle(input: TriggerLoopCycleInput): Promise<void> {
  const { userId, tenantId, reason } = input

  // 5-minute idempotency bucket
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000))
  const dedupeKey = `loop-observe:${userId}:${bucket}`

  const cycle = await db.loopCycle.create({
    data: { userId, tenantId, triggeredBy: reason },
    select: { id: true },
  })

  await enqueueOrchestrationJob({
    tenantId,
    queue: "LOOP",
    jobType: "loop.observe",
    payload: { cycleId: cycle.id, userId, tenantId, reason },
    dedupeKey,
    priority: 80,
  })

  logger.info("Loop cycle triggered", { cycleId: cycle.id, userId, reason })
}
