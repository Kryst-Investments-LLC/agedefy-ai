import { db } from "@/lib/db"
import { cleanupExpiredOrchestrationJobs } from "@/lib/jobs/queue"
import { purgeExpiredTransientData } from "@/lib/retention/data-retention"

async function main() {
  const deleted = await cleanupExpiredOrchestrationJobs()
  const transient = await purgeExpiredTransientData()
  console.log(JSON.stringify({ orchestrationJobsDeleted: deleted, ...transient }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  await db.$disconnect()
})