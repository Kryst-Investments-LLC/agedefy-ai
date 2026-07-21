import { Prisma, type OrchestrationJob, type OrchestrationJobQueue, type OrchestrationJobStatus, type PrismaClient } from "@prisma/client"

import { createReviewItem, logAudit } from "@/lib/audit"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { jobExecutionCounter } from "@/lib/observability/telemetry"

const ORCHESTRATION_QUEUES: OrchestrationJobQueue[] = ["AI", "INGESTION", "NOTIFICATION", "GOVERNANCE", "LOOP"]
const BACKLOG_STATUSES: OrchestrationJobStatus[] = ["QUEUED", "FAILED"]
const TERMINAL_STATUSES: OrchestrationJobStatus[] = ["SUCCEEDED", "DEAD_LETTER", "CANCELED"]
const RETRYABLE_STATUSES: OrchestrationJobStatus[] = ["QUEUED", "FAILED"]

type PrismaClientLike = PrismaClient | Prisma.TransactionClient

export type OrchestrationJobStatusCounts = Record<OrchestrationJobStatus, number>

export type OrchestrationJobQueueSummary = {
  queue: OrchestrationJobQueue
  counts: OrchestrationJobStatusCounts
  backlogCount: number
  deadLetterCount: number
  inFlightCount: number
  terminalCount: number
  oldestBacklogAt: Date | null
  oldestDeadLetterAt: Date | null
}

export type OrchestrationJobTenantSummary = {
  totals: OrchestrationJobStatusCounts
  backlogCount: number
  deadLetterCount: number
  inFlightCount: number
  terminalCount: number
  queues: Record<OrchestrationJobQueue, OrchestrationJobQueueSummary>
}

export type EnqueueOrchestrationJobInput = {
  tenantId: string
  organizationId?: string
  queue: OrchestrationJobQueue
  jobType: string
  payload: Prisma.InputJsonValue
  dedupeKey?: string
  priority?: number
  maxAttempts?: number
  availableAt?: Date
  retainedUntil?: Date
  createdByUserId?: string
  parentJobId?: string
  correlationId?: string
  requestId?: string
  traceContext?: Prisma.InputJsonValue
}

export type LeaseOrchestrationJobsOptions = {
  tenantId?: string
  queue?: OrchestrationJobQueue
  batchSize?: number
  leaseMs?: number
  now?: Date
  /** Max jobs one tenant may hold LEASED at once (fairness). 0/undefined disables. */
  maxConcurrentLeasesPerTenant?: number
}

export type OrchestrationJobListOptions = {
  tenantId: string
  queue?: OrchestrationJobQueue
  status?: OrchestrationJobStatus
  jobType?: string
  cursor?: string
  take?: number
}

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function retentionHours() {
  return parseNumber(env.JOB_RETENTION_HOURS, 24 * 7)
}

function truncateErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, 1000)
}

function createEmptyStatusCounts(): OrchestrationJobStatusCounts {
  return {
    QUEUED: 0,
    LEASED: 0,
    SUCCEEDED: 0,
    FAILED: 0,
    DEAD_LETTER: 0,
    CANCELED: 0,
  }
}

export function getJobRuntimeConfig() {
  return {
    batchSize: parseNumber(env.JOB_WORKER_BATCH_SIZE, 50),
    pollIntervalMs: parseNumber(env.JOB_WORKER_POLL_INTERVAL_MS, 3_000),
    maxAttempts: parseNumber(env.JOB_WORKER_MAX_ATTEMPTS, 8),
    retryDelayMs: parseNumber(env.JOB_WORKER_RETRY_DELAY_MS, 15_000),
    leaseMs: parseNumber(env.JOB_WORKER_LEASE_MS, 120_000),
    // Per-tenant fairness cap: max jobs a single tenant may hold LEASED at once,
    // so one tenant's backlog can't starve the shared worker pool. 0 disables it.
    maxConcurrentLeasesPerTenant: parseNumber(env.JOB_MAX_CONCURRENT_LEASES_PER_TENANT, 200),
    tenantId: env.JOB_TENANT_ID?.trim() || undefined,
  }
}

export async function enqueueOrchestrationJob(
  input: EnqueueOrchestrationJobInput,
  client: PrismaClientLike = db,
): Promise<OrchestrationJob> {
  if (input.dedupeKey) {
    const existing = await client.orchestrationJob.findUnique({
      where: {
        tenantId_dedupeKey: {
          tenantId: input.tenantId,
          dedupeKey: input.dedupeKey,
        },
      },
    })

    if (existing) {
      return existing
    }
  }

  const retainedUntil = input.retainedUntil ?? new Date(Date.now() + retentionHours() * 60 * 60 * 1000)

  return client.orchestrationJob.create({
    data: {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      queue: input.queue,
      jobType: input.jobType,
      dedupeKey: input.dedupeKey,
      priority: input.priority ?? 100,
      payload: input.payload,
      maxAttempts: input.maxAttempts ?? getJobRuntimeConfig().maxAttempts,
      availableAt: input.availableAt ?? new Date(),
      retainedUntil,
      createdByUserId: input.createdByUserId,
      parentJobId: input.parentJobId,
      correlationId: input.correlationId,
      requestId: input.requestId,
      traceContext: input.traceContext,
    },
  })
}

export async function leaseAvailableOrchestrationJobs(
  options: LeaseOrchestrationJobsOptions = {},
  client: PrismaClientLike = db,
): Promise<OrchestrationJob[]> {
  const now = options.now ?? new Date()
  const batchSize = options.batchSize ?? getJobRuntimeConfig().batchSize
  const leaseMs = options.leaseMs ?? getJobRuntimeConfig().leaseMs
  const maxPerTenant = options.maxConcurrentLeasesPerTenant ?? getJobRuntimeConfig().maxConcurrentLeasesPerTenant
  const capEnabled = typeof maxPerTenant === "number" && maxPerTenant > 0

  // Per-tenant fairness (P1-PERF-015): count each tenant's currently-active leases
  // so a single tenant's backlog can't monopolise the shared worker pool. Every
  // tenant seen in the scan keeps its remaining headroom (which may be <= 0);
  // tenants already at the cap are also excluded from the candidate scan up front
  // (only in the cross-tenant case — a single-tenant lease relies on the per-
  // candidate check below, since the tenantId filter already scopes the query).
  const tenantHeadroom = new Map<string, number>()
  const cappedTenantIds: string[] = []
  if (capEnabled) {
    const activeByTenant = await client.orchestrationJob.groupBy({
      by: ["tenantId"],
      where: { status: "LEASED", leaseExpiresAt: { gt: now } },
      _count: { _all: true },
    })
    for (const row of activeByTenant) {
      const headroom = maxPerTenant - row._count._all
      tenantHeadroom.set(row.tenantId, headroom)
      if (headroom <= 0) cappedTenantIds.push(row.tenantId)
    }
  }

  const candidates = await client.orchestrationJob.findMany({
    where: {
      ...(options.tenantId ? { tenantId: options.tenantId } : {}),
      ...(capEnabled && !options.tenantId && cappedTenantIds.length > 0
        ? { tenantId: { notIn: cappedTenantIds } }
        : {}),
      ...(options.queue ? { queue: options.queue } : {}),
      availableAt: { lte: now },
      OR: [
        { status: { in: RETRYABLE_STATUSES } },
        { status: "LEASED", leaseExpiresAt: { lt: now } },
      ],
    },
    orderBy: [{ priority: "asc" }, { availableAt: "asc" }, { createdAt: "asc" }],
    take: batchSize,
  })

  const leased: OrchestrationJob[] = []

  for (const candidate of candidates) {
    if (capEnabled) {
      // A tenant not seen in the active scan has full headroom (maxPerTenant).
      const remaining = tenantHeadroom.get(candidate.tenantId) ?? maxPerTenant
      if (remaining <= 0) continue
    }

    const claimed = await client.orchestrationJob.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: { in: RETRYABLE_STATUSES } },
          { status: "LEASED", leaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        status: "LEASED",
        leasedAt: now,
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
        attempts: { increment: 1 },
      },
    })

    if (claimed.count === 0) {
      continue
    }

    if (capEnabled) {
      const remaining = tenantHeadroom.get(candidate.tenantId) ?? maxPerTenant
      tenantHeadroom.set(candidate.tenantId, remaining - 1)
    }

    const job = await client.orchestrationJob.findUnique({ where: { id: candidate.id } })
    if (job) {
      leased.push(job)
    }
  }

  return leased
}

/**
 * Return a leased-but-unstarted job to the queue for immediate handoff to
 * another worker (graceful shutdown / job lease handoff, P1-OPS-011). Resets the
 * lease and undoes the attempt increment applied at lease time, since the job
 * never actually ran, so a rolling deploy never burns a retry. No-op if the job
 * is no longer LEASED (already completed/failed/reclaimed). Returns the number of
 * jobs released (0 or 1).
 */
export async function releaseOrchestrationJob(
  jobId: string,
  client: PrismaClientLike = db,
): Promise<number> {
  const released = await client.orchestrationJob.updateMany({
    where: { id: jobId, status: "LEASED" },
    data: {
      status: "QUEUED",
      availableAt: new Date(),
      leasedAt: null,
      leaseExpiresAt: null,
      attempts: { decrement: 1 },
    },
  })
  return released.count
}

export async function completeOrchestrationJob(
  jobId: string,
  result: Prisma.InputJsonValue | undefined,
  client: PrismaClientLike = db,
): Promise<OrchestrationJob> {
  const updated = await client.orchestrationJob.update({
    where: { id: jobId },
    data: {
      status: "SUCCEEDED",
      result,
      completedAt: new Date(),
      leaseExpiresAt: null,
      leasedAt: null,
      lastError: null,
    },
  })
  jobExecutionCounter.add(1, { status: "succeeded", queue: updated.queue, jobType: updated.jobType })
  return updated
}

export async function failOrchestrationJob(
  jobId: string,
  error: unknown,
  options: {
    retryDelayMs?: number
  } = {},
  client: PrismaClientLike = db,
): Promise<OrchestrationJob> {
  const job = await client.orchestrationJob.findUnique({ where: { id: jobId } })
  if (!job) {
    throw new Error(`Orchestration job ${jobId} not found`)
  }

  const terminalFailure = job.attempts >= job.maxAttempts
  const nextStatus: OrchestrationJobStatus = terminalFailure ? "DEAD_LETTER" : "FAILED"
  const retryDelayMs = options.retryDelayMs ?? getJobRuntimeConfig().retryDelayMs
  const updated = await client.orchestrationJob.update({
    where: { id: jobId },
    data: {
      status: nextStatus,
      lastError: truncateErrorMessage(error),
      availableAt: terminalFailure ? new Date() : new Date(Date.now() + retryDelayMs),
      leaseExpiresAt: null,
      leasedAt: null,
      completedAt: terminalFailure ? new Date() : null,
    },
  })

  jobExecutionCounter.add(1, {
    status: terminalFailure ? "dead_letter" : "failed",
    queue: updated.queue,
    jobType: updated.jobType,
  })

  if (terminalFailure) {
    await createReviewItem({
      title: `Background job dead-lettered: ${updated.jobType}`,
      category: "background-jobs",
      severity: updated.queue === "GOVERNANCE" ? "HIGH" : "MEDIUM",
      details: `Job ${updated.id} in queue ${updated.queue} exhausted retries. Last error: ${updated.lastError ?? "unknown"}`,
      relatedEntityType: "OrchestrationJob",
      relatedEntityId: updated.id,
    })

    await logAudit({
      actorUserId: updated.createdByUserId ?? undefined,
      tenantId: updated.tenantId,
      action: "jobs.dead_lettered",
      entityType: "OrchestrationJob",
      entityId: updated.id,
      details: {
        queue: updated.queue,
        jobType: updated.jobType,
        attempts: updated.attempts,
        lastError: updated.lastError,
      },
    })
  }

  return updated
}

export async function retryOrchestrationJob(
  jobId: string,
  tenantId: string,
  client: PrismaClientLike = db,
): Promise<OrchestrationJob> {
  const existing = await client.orchestrationJob.findFirst({
    where: { id: jobId, tenantId },
  })

  if (!existing) {
    throw new Error(`Orchestration job ${jobId} not found for tenant ${tenantId}`)
  }

  return client.orchestrationJob.update({
    where: { id: jobId },
    data: {
      status: "QUEUED",
      availableAt: new Date(),
      leaseExpiresAt: null,
      leasedAt: null,
      canceledAt: null,
      completedAt: null,
      lastError: null,
    },
  })
}

/**
 * Bulk dead-letter replay (P1-PERF-015): return DEAD_LETTER jobs to the queue
 * with a FRESH retry budget (attempts reset to 0) — for replaying after the
 * root cause is fixed. Unlike retryOrchestrationJob (a single manual retry that
 * keeps attempts, giving one more shot), this restores the full maxAttempts.
 * Scoped to a tenant; optionally narrowed to a queue or a specific job list.
 * Returns the number of jobs replayed.
 */
export async function replayDeadLetterJobs(
  options: { tenantId: string; queue?: OrchestrationJobQueue; jobIds?: string[]; now?: Date },
  client: PrismaClientLike = db,
): Promise<number> {
  const now = options.now ?? new Date()
  const result = await client.orchestrationJob.updateMany({
    where: {
      status: "DEAD_LETTER",
      tenantId: options.tenantId,
      ...(options.queue ? { queue: options.queue } : {}),
      ...(options.jobIds ? { id: { in: options.jobIds } } : {}),
    },
    data: {
      status: "QUEUED",
      attempts: 0,
      availableAt: now,
      leasedAt: null,
      leaseExpiresAt: null,
      completedAt: null,
      lastError: null,
    },
  })
  return result.count
}

export async function cancelOrchestrationJob(
  jobId: string,
  tenantId: string,
  client: PrismaClientLike = db,
): Promise<OrchestrationJob> {
  const existing = await client.orchestrationJob.findFirst({ where: { id: jobId, tenantId } })
  if (!existing) {
    throw new Error(`Orchestration job ${jobId} not found for tenant ${tenantId}`)
  }

  return client.orchestrationJob.update({
    where: { id: jobId },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
      leaseExpiresAt: null,
      leasedAt: null,
      completedAt: new Date(),
    },
  })
}

export async function listOrchestrationJobs(
  options: OrchestrationJobListOptions,
  client: PrismaClientLike = db,
) {
  const take = options.take ?? 25
  const jobs = await client.orchestrationJob.findMany({
    where: {
      tenantId: options.tenantId,
      ...(options.queue ? { queue: options.queue } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.jobType ? { jobType: options.jobType } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: take + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  })

  const hasMore = jobs.length > take
  const items = hasMore ? jobs.slice(0, take) : jobs
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null

  return { items, nextCursor }
}

export async function getOrchestrationJobMetrics(client: PrismaClientLike = db) {
  const grouped = await client.orchestrationJob.groupBy({
    by: ["queue", "status"],
    _count: { _all: true },
  })

  return grouped.reduce<Record<string, Record<string, number>>>((acc, item) => {
    acc[item.queue] ??= {}
    acc[item.queue][item.status] = item._count._all
    return acc
  }, {})
}

export async function getOrchestrationJobSummary(
  tenantId: string,
  client: PrismaClientLike = db,
): Promise<OrchestrationJobTenantSummary> {
  const grouped = await client.orchestrationJob.groupBy({
    by: ["queue", "status"],
    where: { tenantId },
    _count: { _all: true },
  })

  const queues = Object.fromEntries(
    ORCHESTRATION_QUEUES.map((queue) => [
      queue,
      {
        queue,
        counts: createEmptyStatusCounts(),
        backlogCount: 0,
        deadLetterCount: 0,
        inFlightCount: 0,
        terminalCount: 0,
        oldestBacklogAt: null,
        oldestDeadLetterAt: null,
      },
    ]),
  ) as Record<OrchestrationJobQueue, OrchestrationJobQueueSummary>

  const totals = createEmptyStatusCounts()

  for (const item of grouped) {
    const count = item._count._all
    queues[item.queue].counts[item.status] = count
    totals[item.status] += count
  }

  const queueAges = await Promise.all(
    ORCHESTRATION_QUEUES.map(async (queue) => {
      const [oldestBacklog, oldestDeadLetter] = await Promise.all([
        client.orchestrationJob.findFirst({
          where: {
            tenantId,
            queue,
            status: { in: BACKLOG_STATUSES },
          },
          orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
          select: { availableAt: true },
        }),
        client.orchestrationJob.findFirst({
          where: {
            tenantId,
            queue,
            status: "DEAD_LETTER",
          },
          orderBy: [{ completedAt: "asc" }, { createdAt: "asc" }],
          select: { completedAt: true, createdAt: true },
        }),
      ])

      return {
        queue,
        oldestBacklogAt: oldestBacklog?.availableAt ?? null,
        oldestDeadLetterAt: oldestDeadLetter?.completedAt ?? oldestDeadLetter?.createdAt ?? null,
      }
    }),
  )

  for (const item of queueAges) {
    const summary = queues[item.queue]
    summary.backlogCount = BACKLOG_STATUSES.reduce((sum, status) => sum + summary.counts[status], 0)
    summary.deadLetterCount = summary.counts.DEAD_LETTER
    summary.inFlightCount = summary.counts.LEASED
    summary.terminalCount = TERMINAL_STATUSES.reduce((sum, status) => sum + summary.counts[status], 0)
    summary.oldestBacklogAt = item.oldestBacklogAt
    summary.oldestDeadLetterAt = item.oldestDeadLetterAt
  }

  return {
    totals,
    backlogCount: BACKLOG_STATUSES.reduce((sum, status) => sum + totals[status], 0),
    deadLetterCount: totals.DEAD_LETTER,
    inFlightCount: totals.LEASED,
    terminalCount: TERMINAL_STATUSES.reduce((sum, status) => sum + totals[status], 0),
    queues,
  }
}

export async function cleanupExpiredOrchestrationJobs(client: PrismaClientLike = db) {
  const now = new Date()
  const deleted = await client.orchestrationJob.deleteMany({
    where: {
      status: { in: TERMINAL_STATUSES },
      retainedUntil: { lt: now },
    },
  })

  logger.info("Expired orchestration jobs deleted", { count: deleted.count })
  return deleted.count
}