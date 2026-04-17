import { afterEach, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import {
  completeOrchestrationJob,
  enqueueOrchestrationJob,
  failOrchestrationJob,
  leaseAvailableOrchestrationJobs,
} from "@/lib/jobs/queue"

async function cleanupTenant(tenantId: string) {
  await db.orchestrationJob.deleteMany({ where: { tenantId } })
}

describe("orchestration queue", () => {
  afterEach(async (context) => {
    const tenantId = context.task.name.match(/tenant:(\S+)/)?.[1]
    if (tenantId) {
      await cleanupTenant(tenantId)
    }
  })

  it("leases and completes queued jobs tenant:jobs_complete", async () => {
    const tenantId = "jobs_complete"
    const job = await enqueueOrchestrationJob({
      tenantId,
      queue: "AI",
      jobType: "ai.governance.audit",
      dedupeKey: `test:${tenantId}`,
      payload: {
        provider: "openai",
        model: "gpt-4o-mini",
        route: "/api/ai/openai",
        requestId: `req:${tenantId}`,
        queryLength: 12,
        tenantId,
        outcome: "success",
        actor: {},
      },
    })

    const leased = await leaseAvailableOrchestrationJobs({ tenantId, batchSize: 5, leaseMs: 60_000 })
    expect(leased).toHaveLength(1)
    expect(leased[0]?.id).toBe(job.id)

    const completed = await completeOrchestrationJob(job.id, { ok: true })
    expect(completed.status).toBe("SUCCEEDED")
  })

  it("dead-letters exhausted jobs tenant:jobs_deadletter", async () => {
    const tenantId = "jobs_deadletter"
    const job = await enqueueOrchestrationJob({
      tenantId,
      queue: "GOVERNANCE",
      jobType: "governance.review.escalation",
      payload: {
        title: "Test review",
        category: "background-jobs",
        severity: "HIGH",
        details: "Escalate this review item",
        tenantId,
      },
      maxAttempts: 1,
    })

    await leaseAvailableOrchestrationJobs({ tenantId, batchSize: 5, leaseMs: 60_000 })
    const failed = await failOrchestrationJob(job.id, new Error("synthetic failure"))
    expect(failed.status).toBe("DEAD_LETTER")
    expect(failed.lastError).toContain("synthetic failure")
  })
})