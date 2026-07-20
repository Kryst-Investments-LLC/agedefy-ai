import { setTimeout as delay } from "node:timers/promises"

import { db } from "@/lib/db"
import { processOrchestrationJob, serializeJobResult } from "@/lib/jobs/handlers"
import {
  completeOrchestrationJob,
  failOrchestrationJob,
  getJobRuntimeConfig,
  leaseAvailableOrchestrationJobs,
  releaseOrchestrationJob,
} from "@/lib/jobs/queue"
import { logger } from "@/lib/logger"

async function main() {
  const config = getJobRuntimeConfig()
  let stopping = false

  const requestStop = (signal: string) => {
    // Second signal (or an impatient operator) forces an immediate exit — used
    // when an in-flight job hangs past the orchestrator's SIGTERM grace period.
    if (stopping) {
      logger.warn("Orchestration worker received second signal, forcing exit", { signal })
      process.exit(1)
    }
    stopping = true
    logger.info("Orchestration worker draining before shutdown", { signal })
  }

  process.on("SIGINT", requestStop)
  process.on("SIGTERM", requestStop)

  logger.info("Orchestration worker started", config)

  while (!stopping) {
    const jobs = await leaseAvailableOrchestrationJobs({
      tenantId: config.tenantId,
      batchSize: config.batchSize,
      leaseMs: config.leaseMs,
    })

    if (jobs.length === 0) {
      await delay(config.pollIntervalMs)
      continue
    }

    for (let i = 0; i < jobs.length; i++) {
      // A shutdown signal that arrives mid-batch: finish the job already in
      // flight, but hand the rest of the leased batch straight back to the
      // queue so a surviving worker picks them up immediately instead of
      // waiting out the lease. Undoes each job's lease-time attempt increment.
      if (stopping) {
        const remaining = jobs.slice(i)
        const results = await Promise.allSettled(remaining.map((j) => releaseOrchestrationJob(j.id)))
        const released = results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value : 0), 0)
        logger.info("Orchestration worker released leased jobs for handoff", {
          released,
          requested: remaining.length,
        })
        break
      }

      const job = jobs[i]
      try {
        const result = await processOrchestrationJob(job)
        await completeOrchestrationJob(job.id, serializeJobResult(result))
      } catch (error) {
        await failOrchestrationJob(job.id, error, { retryDelayMs: config.retryDelayMs })
      }
    }
  }

  logger.info("Orchestration worker stopped cleanly")
}

main().catch(async (error) => {
  logger.error("Orchestration worker crashed", {
    error: error instanceof Error ? error.message : String(error),
  })
  process.exitCode = 1
}).finally(async () => {
  await db.$disconnect()
})