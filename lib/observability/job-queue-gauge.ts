import { metrics } from "@opentelemetry/api"

import { db } from "@/lib/db"
import type { PrismaClient } from "@prisma/client"

type Client = Pick<PrismaClient, "orchestrationJob">

/**
 * Age in milliseconds of the oldest orchestration job that is queued and already
 * due (`availableAt <= now`) — the job-age SLI (OBS-004). Returns 0 when nothing
 * is waiting. Extracted from the gauge callback so it is directly testable.
 */
export async function computeOldestQueuedJobAgeMs(
  client: Client = db,
  now: Date = new Date(),
): Promise<number> {
  const oldest = await client.orchestrationJob.findFirst({
    where: { status: "QUEUED", availableAt: { lte: now } },
    orderBy: { availableAt: "asc" },
    select: { availableAt: true },
  })
  return oldest ? Math.max(0, now.getTime() - oldest.availableAt.getTime()) : 0
}

/**
 * Register the observable job-queue-age gauge. Called from instrumentation.ts
 * only after the OTel SDK is initialized, so the callback (a cheap indexed
 * query) runs on real metric collection, not on every request. Any error is
 * swallowed — a metric scrape must never throw.
 */
export function registerJobQueueAgeGauge(): void {
  const meter = metrics.getMeter("biozephyra")
  const gauge = meter.createObservableGauge("biozephyra.orchestration.job.oldest_queued_age_ms", {
    description: "Age in ms of the oldest due-and-queued orchestration job (0 when the queue is empty)",
    unit: "ms",
  })
  gauge.addCallback(async (result) => {
    try {
      result.observe(await computeOldestQueuedJobAgeMs())
    } catch {
      // Swallow — never let an observability scrape crash the process.
    }
  })
}
