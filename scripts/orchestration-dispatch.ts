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
  const jobs = await leaseAvailableOrchestrationJobs({
    tenantId: config.tenantId,
    batchSize: config.batchSize,
    leaseMs: config.leaseMs,
  })

  let succeeded = 0
  let failed = 0

  for (const job of jobs) {
    try {
      const result = await processOrchestrationJob(job)
      await completeOrchestrationJob(job.id, serializeJobResult(result))
      succeeded += 1
    } catch (error) {
      await failOrchestrationJob(job.id, error, { retryDelayMs: config.retryDelayMs })
      failed += 1
    }
  }

  logger.info("Orchestration batch dispatch completed", {
    leased: jobs.length,
    succeeded,
    failed,
    tenantId: config.tenantId,
  })

  if (failed > 0) {
    process.exitCode = 1
  }
}

main().catch(async (error) => {
  logger.error("Orchestration batch dispatch failed", {
    error: error instanceof Error ? error.message : String(error),
  })
  process.exitCode = 1
}).finally(async () => {
  await db.$disconnect()
})