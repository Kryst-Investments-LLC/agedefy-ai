import { setTimeout as delay } from "node:timers/promises"

import { db } from "@/lib/db"
import { processOrchestrationJob, serializeJobResult } from "@/lib/jobs/handlers"
import {
  completeOrchestrationJob,
  failOrchestrationJob,
  getJobRuntimeConfig,
  leaseAvailableOrchestrationJobs,
} from "@/lib/jobs/queue"
import { logger } from "@/lib/logger"

async function main() {
  const config = getJobRuntimeConfig()
  let stopping = false

  const requestStop = (signal: string) => {
    stopping = true
    logger.info("Orchestration worker received shutdown signal", { signal })
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

    for (const job of jobs) {
      try {
        const result = await processOrchestrationJob(job)
        await completeOrchestrationJob(job.id, serializeJobResult(result))
      } catch (error) {
        await failOrchestrationJob(job.id, error, { retryDelayMs: config.retryDelayMs })
      }
    }
  }
}

main().catch(async (error) => {
  logger.error("Orchestration worker crashed", {
    error: error instanceof Error ? error.message : String(error),
  })
  process.exitCode = 1
}).finally(async () => {
  await db.$disconnect()
})