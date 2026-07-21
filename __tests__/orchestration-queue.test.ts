import { afterEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import {
  completeOrchestrationJob,
  enqueueOrchestrationJob,
  failOrchestrationJob,
  JobQuotaExceededError,
  leaseAvailableOrchestrationJobs,
  releaseOrchestrationJob,
  replayDeadLetterJobs,
} from "@/lib/jobs/queue"
import { computeOldestQueuedJobAgeMs } from "@/lib/observability/job-queue-gauge"
import { jobExecutionCounter } from "@/lib/observability/telemetry"

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

    const counterSpy = vi.spyOn(jobExecutionCounter, "add")
    const completed = await completeOrchestrationJob(job.id, { ok: true })
    expect(completed.status).toBe("SUCCEEDED")
    expect(counterSpy).toHaveBeenCalledWith(1, expect.objectContaining({ status: "succeeded" }))
    counterSpy.mockRestore()
  })

  it("releases a leased job for handoff and undoes the attempt increment tenant:jobs_release", async () => {
    const tenantId = "jobs_release"
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
    expect(leased[0]?.status).toBe("LEASED")
    expect(leased[0]?.attempts).toBe(1)

    // Graceful-shutdown handoff: return the unstarted job to the queue.
    const releasedCount = await releaseOrchestrationJob(job.id)
    expect(releasedCount).toBe(1)

    const afterRelease = await db.orchestrationJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(afterRelease.status).toBe("QUEUED")
    expect(afterRelease.attempts).toBe(0) // lease increment undone — no burned retry
    expect(afterRelease.leaseExpiresAt).toBeNull()
    expect(afterRelease.leasedAt).toBeNull()

    // Immediately re-leasable by another worker (no wait for lease expiry).
    const releasedAgain = await releaseOrchestrationJob(job.id)
    expect(releasedAgain).toBe(0) // no-op when not LEASED

    const reLeased = await leaseAvailableOrchestrationJobs({ tenantId, batchSize: 5, leaseMs: 60_000 })
    expect(reLeased).toHaveLength(1)
    expect(reLeased[0]?.id).toBe(job.id)
    expect(reLeased[0]?.attempts).toBe(1)
  })

  it("reports the oldest due-and-queued job age for the job-age SLI tenant:jobs_age", async () => {
    const tenantId = "jobs_age"
    // No queued job yet → age is 0.
    const baseline = await computeOldestQueuedJobAgeMs(db, new Date())
    expect(baseline).toBeGreaterThanOrEqual(0)

    const availableAt = new Date(Date.now() - 90_000) // due 90s ago
    await enqueueOrchestrationJob({
      tenantId,
      queue: "AI",
      jobType: "ai.governance.audit",
      dedupeKey: `test:${tenantId}`,
      availableAt,
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

    const now = new Date()
    const age = await computeOldestQueuedJobAgeMs(db, now)
    // The gauge returns the age of the OLDEST due-and-queued job (max age). Our
    // job has been due ~90s, so the oldest is at least that old — a deterministic
    // lower bound even if another tenant has an older job in the shared test DB.
    expect(age).toBeGreaterThanOrEqual(80_000)

    await db.orchestrationJob.deleteMany({ where: { tenantId } })
  })

  it("caps concurrent leases per tenant for fairness tenant:cap_fair", async () => {
    const tenantId = "cap_fair"
    for (let i = 0; i < 3; i++) {
      await enqueueOrchestrationJob({
        tenantId,
        queue: "AI",
        jobType: "ai.governance.audit",
        dedupeKey: `cap:${tenantId}:${i}`,
        payload: {
          provider: "openai",
          model: "gpt-4o-mini",
          route: "/api/ai/openai",
          requestId: `req:${tenantId}:${i}`,
          queryLength: 12,
          tenantId,
          outcome: "success",
          actor: {},
        },
      })
    }

    // Only 2 of the 3 available jobs are leased — the tenant's cap.
    const first = await leaseAvailableOrchestrationJobs({
      tenantId,
      batchSize: 10,
      leaseMs: 60_000,
      maxConcurrentLeasesPerTenant: 2,
    })
    expect(first).toHaveLength(2)

    // Tenant now holds 2 active leases → a second lease returns nothing (excluded).
    const second = await leaseAvailableOrchestrationJobs({
      tenantId,
      batchSize: 10,
      leaseMs: 60_000,
      maxConcurrentLeasesPerTenant: 2,
    })
    expect(second).toHaveLength(0)

    // The third job stays QUEUED, waiting for headroom.
    expect(await db.orchestrationJob.count({ where: { tenantId, status: "QUEUED" } })).toBe(1)
  })

  it("rejects enqueue once a tenant hits its pending-job quota tenant:enqueue_quota", async () => {
    const tenantId = "enqueue_quota"
    const makeInput = (i: number) => ({
      tenantId,
      queue: "AI" as const,
      jobType: "ai.governance.audit",
      dedupeKey: `quota:${tenantId}:${i}`,
      payload: {
        provider: "openai",
        model: "gpt-4o-mini",
        route: "/api/ai/openai",
        requestId: `req:${tenantId}:${i}`,
        queryLength: 12,
        tenantId,
        outcome: "success",
        actor: {},
      },
    })

    // Quota of 2: the first two enqueues succeed, the third is rejected.
    await enqueueOrchestrationJob(makeInput(0), db, { maxPendingPerTenant: 2 })
    await enqueueOrchestrationJob(makeInput(1), db, { maxPendingPerTenant: 2 })
    await expect(enqueueOrchestrationJob(makeInput(2), db, { maxPendingPerTenant: 2 })).rejects.toBeInstanceOf(
      JobQuotaExceededError,
    )
    expect(await db.orchestrationJob.count({ where: { tenantId } })).toBe(2)

    // A duplicate (same dedupeKey) is a no-op that never counts against the quota.
    const dup = await enqueueOrchestrationJob(makeInput(0), db, { maxPendingPerTenant: 2 })
    expect(dup.dedupeKey).toBe(`quota:${tenantId}:0`)

    // Terminal jobs don't count as pending — completing one frees quota headroom.
    const leased = await leaseAvailableOrchestrationJobs({ tenantId, batchSize: 1, leaseMs: 60_000 })
    await completeOrchestrationJob(leased[0].id, { ok: true })
    const after = await enqueueOrchestrationJob(makeInput(3), db, { maxPendingPerTenant: 2 })
    expect(after.id).toBeTruthy()

    await db.orchestrationJob.deleteMany({ where: { tenantId } })
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
    const counterSpy = vi.spyOn(jobExecutionCounter, "add")
    const failed = await failOrchestrationJob(job.id, new Error("synthetic failure"))
    expect(failed.status).toBe("DEAD_LETTER")
    expect(failed.lastError).toContain("synthetic failure")
    expect(counterSpy).toHaveBeenCalledWith(1, expect.objectContaining({ status: "dead_letter" }))
    counterSpy.mockRestore()

    // Bulk replay restores a fresh retry budget and makes the job leasable again.
    const replayed = await replayDeadLetterJobs({ tenantId })
    expect(replayed).toBe(1)
    const afterReplay = await db.orchestrationJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(afterReplay.status).toBe("QUEUED")
    expect(afterReplay.attempts).toBe(0) // full budget restored (unlike single retry)
    expect(afterReplay.lastError).toBeNull()

    const releasable = await leaseAvailableOrchestrationJobs({ tenantId, batchSize: 5, leaseMs: 60_000 })
    expect(releasable.map((j) => j.id)).toContain(job.id)

    // Replaying again when nothing is dead-lettered is a no-op.
    expect(await replayDeadLetterJobs({ tenantId })).toBe(0)
  })
})