import { db } from "@/lib/db"
import { cleanupExpiredOrchestrationJobs } from "@/lib/jobs/queue"

async function main() {
  const deleted = await cleanupExpiredOrchestrationJobs()
  console.log(JSON.stringify({ deleted }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  await db.$disconnect()
})